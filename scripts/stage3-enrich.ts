import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { ENRICH_TOP_N_DEFAULT } from '../config/scoring.js'
import { fetchAdvPdf, fetchHomepage } from '../src/lib/sec-client.js'
import { extractFromAdvPdf } from '../src/lib/pdf-extract.js'
import { htmlToText, scanAltsText } from '../src/lib/web-enrich.js'
import { looksLikeEmptyShell, fetchHomepageViaApify } from '../src/lib/apify-client.js'
import { planEnrichment, agenticEnabled } from '../src/lib/enrich-agent.js'
import type { Enrichment, ScoredFirm } from '../src/types.js'

/**
 * Stage 3 — enrich the top candidates with the two signals the bulk roster
 * can't provide: custodian names (ADV PDF Schedule D 5.K(3)) and homepage
 * alts language. Every failure skips that signal for that firm, never crashes.
 * Re-runs stage 2 afterwards so the ranked outputs reflect enrichment.
 */
export async function runEnrich(topN = ENRICH_TOP_N_DEFAULT): Promise<void> {
  console.log(`stage 3 — enrich top ${topN}`)
  const scored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json', 'utf8'))
  const targets = scored.slice(0, topN)

  const enrichments: Record<string, Enrichment> = existsSync('data/enrichments.json')
    ? JSON.parse(readFileSync('data/enrichments.json', 'utf8'))
    : {}

  // Optional STALE bulk fallback (built by stage 1 --with-bulk). Live PDF always
  // overrides; bulk only fills firms the live-PDF pass couldn't enrich.
  const bulk: Record<string, { fundDetail: Enrichment['fundDetail']; custodianNames: string[] }> = existsSync(
    'data/schedule-d-bulk.json',
  )
    ? JSON.parse(readFileSync('data/schedule-d-bulk.json', 'utf8'))
    : {}
  const bulkAvailable = Object.keys(bulk).length > 0
  if (bulkAvailable) console.log(`  bulk fallback available for ${Object.keys(bulk).length.toLocaleString()} firms (stale 2024-12)`)

  if (agenticEnabled()) console.log('  ⚙ KKR_AGENTIC_ENRICH=1 — Opus planner decides per-firm enrichment actions')

  let pdfOk = 0
  let webOk = 0
  let bulkOk = 0
  for (const [i, s] of targets.entries()) {
    const firm = s.firm
    const existing = enrichments[firm.crd]
    const enrichment: Enrichment = existing ?? {
      custodians: [],
      custodianSource: 'none',
      structureHits: [],
      competitorHits: [],
      websiteFetchedAt: null,
    }

    // [KKR-RIA] agentic plan: which actions to run for this firm (or deterministic default)
    const plan = await planEnrichment(s)

    if (enrichment.custodianSource === 'none' && plan.fetch_pdf) {
      try {
        const pdf = await fetchAdvPdf(firm.crd)
        const { custodians, fundDetail } = await extractFromAdvPdf(pdf)
        enrichment.custodians = custodians
        enrichment.fundDetail = fundDetail
        enrichment.custodianSource = 'adv-pdf'
        pdfOk++
      } catch (err) {
        console.warn(`  ⚠ [${i + 1}/${targets.length}] ADV PDF failed for ${firm.name} (CRD ${firm.crd}): ${(err as Error).message}`)
      }
    } else {
      pdfOk++
    }

    // Bulk fallback: only when live PDF produced nothing (live PDF always wins).
    if (enrichment.custodianSource === 'none' && bulkAvailable && bulk[firm.crd]) {
      const b = bulk[firm.crd]
      enrichment.fundDetail = b.fundDetail
      // bulk custodian names aren't tier-mapped — surface as plain tier-2 entries
      enrichment.custodians = (b.custodianNames ?? []).map(name => ({ name, tier: 2 as const }))
      enrichment.custodianSource = 'bulk-2024-12'
      bulkOk++
    }

    if (enrichment.websiteFetchedAt === null && firm.website && plan.fetch_homepage) {
      try {
        const html = await fetchHomepage(firm.crd, firm.website) // free raw fetch first
        let text = htmlToText(html)
        if (looksLikeEmptyShell(html)) {
          // raw fetch got an SPA shell — escalate to Apify (JS render)
          try {
            text = await fetchHomepageViaApify(firm.crd, firm.website)
            console.log(`  ↑ apify fallback used for ${firm.name}`)
          } catch (e) {
            console.warn(`  ⚠ apify fallback failed for ${firm.name}: ${(e as Error).message} — using raw text`)
          }
        }
        const scan = scanAltsText(text)
        enrichment.structureHits = scan.structureHits
        enrichment.competitorHits = scan.competitorHits
        enrichment.websiteFetchedAt = new Date().toISOString().slice(0, 10)
        webOk++
      } catch (err) {
        console.warn(`  ⚠ [${i + 1}/${targets.length}] homepage failed for ${firm.name}: ${(err as Error).message}`)
      }
    } else if (enrichment.websiteFetchedAt !== null) {
      webOk++
    }

    enrichments[firm.crd] = enrichment
    if ((i + 1) % 10 === 0)
      console.log(`  … ${i + 1}/${targets.length} enriched (pdf ${pdfOk}, web ${webOk}${bulkOk ? `, bulk ${bulkOk}` : ''})`)
  }

  writeFileSync('data/enrichments.json', JSON.stringify(enrichments))
  console.log(
    `  ✓ data/enrichments.json — custodians for ${pdfOk}/${targets.length}, homepages for ${webOk}/${targets.length}` +
      `${bulkOk ? `, bulk-fallback for ${bulkOk}` : ''}`,
  )

  console.log('  re-scoring with enrichment merged…')
  const { runScore } = await import('./stage2-score.js')
  await runScore()

  // snapshot of the enriched ranked set for validation
  const rescored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json', 'utf8'))
  writeFileSync('data/enriched.json', JSON.stringify(rescored.slice(0, topN)))
}
