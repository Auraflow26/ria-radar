import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { ENRICH_TOP_N_DEFAULT } from '../config/scoring.js'
import { fetchAdvPdf, fetchHomepageRecord } from '../src/lib/sec-client.js'
import { extractFromAdvPdf } from '../src/lib/pdf-extract.js'
import { htmlToText, scanAltsText } from '../src/lib/web-enrich.js'
import { looksLikeEmptyShell, fetchHomepageViaApify } from '../src/lib/apify-client.js'
import { planEnrichment, agenticEnabled } from '../src/lib/enrich-agent.js'
import { isFresh, normalizeWebsite } from '../src/lib/freshness.js'
import type { Enrichment, ScoredFirm } from '../src/types.js'

/**
 * Stage 3 — enrich the top candidates with the two signals the bulk roster
 * can't provide: custodian names (ADV PDF Schedule D 5.K(3)) and homepage
 * alts language. Every failure skips that signal for that firm, never crashes.
 * Re-runs stage 2 afterwards so the ranked outputs reflect enrichment.
 */
export async function runEnrich(topN = ENRICH_TOP_N_DEFAULT, opts: { refresh?: boolean } = {}): Promise<void> {
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

    if (plan.fetch_pdf && (opts.refresh || enrichment.custodianSource !== 'adv-pdf' || !isFresh(enrichment.pdfFetchedAt))) {
      try {
        const pdf = await fetchAdvPdf(firm.crd, opts)
        const { custodians, fundDetail } = await extractFromAdvPdf(pdf)
        enrichment.custodians = custodians
        enrichment.fundDetail = fundDetail
        enrichment.custodianSource = 'adv-pdf'
        enrichment.pdfFetchedAt = JSON.parse(readFileSync(`data/pdfs/${firm.crd}.pdf.receipt.json`, 'utf8')).fetchedAt
        pdfOk++
      } catch (err) {
        enrichment.custodianSource = 'none'
        enrichment.custodians = []
        delete enrichment.fundDetail
        delete enrichment.pdfFetchedAt
        console.warn(`  ⚠ [${i + 1}/${targets.length}] ADV PDF failed for ${firm.name} (CRD ${firm.crd}): ${(err as Error).message}`)
      }
    } else if (enrichment.custodianSource === 'adv-pdf') {
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

    if (firm.website && plan.fetch_homepage && (opts.refresh || !isFresh(enrichment.websiteFetchedAt) || enrichment.websiteUrl !== normalizeWebsite(firm.website))) {
      try {
        const raw = await fetchHomepageRecord(firm.crd, firm.website, opts)
        let text = htmlToText(raw.html)
        let fetchedAt = raw.fetchedAt
        enrichment.websiteSource = 'http'
        delete enrichment.apifyRunId
        delete enrichment.apifyDatasetId
        if (looksLikeEmptyShell(raw.html)) {
          const rendered = await fetchHomepageViaApify(firm.crd, firm.website, opts)
          text = rendered.text
          fetchedAt = rendered.fetchedAt
          enrichment.websiteSource = 'apify'
          enrichment.apifyRunId = rendered.runId
          enrichment.apifyDatasetId = rendered.datasetId
          console.log(`  ↑ apify run ${rendered.runId} for ${firm.name}`)
        }
        const scan = scanAltsText(text)
        enrichment.structureHits = scan.structureHits
        enrichment.competitorHits = scan.competitorHits
        enrichment.websiteFetchedAt = fetchedAt
        enrichment.websiteUrl = normalizeWebsite(firm.website)
        webOk++
      } catch (err) {
        enrichment.websiteFetchedAt = null
        enrichment.structureHits = []
        enrichment.competitorHits = []
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
