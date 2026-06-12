import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { ENRICH_TOP_N_DEFAULT } from '../config/scoring.js'
import { fetchAdvPdf, fetchHomepage } from '../src/lib/sec-client.js'
import { extractFromAdvPdf } from '../src/lib/pdf-extract.js'
import { scanForAltsLanguage } from '../src/lib/web-enrich.js'
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

  let pdfOk = 0
  let webOk = 0
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

    if (enrichment.custodianSource === 'none') {
      try {
        const pdf = await fetchAdvPdf(firm.crd)
        const { custodians } = await extractFromAdvPdf(pdf)
        enrichment.custodians = custodians
        enrichment.custodianSource = 'adv-pdf'
        pdfOk++
      } catch (err) {
        console.warn(`  ⚠ [${i + 1}/${targets.length}] ADV PDF failed for ${firm.name} (CRD ${firm.crd}): ${(err as Error).message}`)
      }
    } else {
      pdfOk++
    }

    if (enrichment.websiteFetchedAt === null && firm.website) {
      try {
        const html = await fetchHomepage(firm.crd, firm.website)
        const scan = scanForAltsLanguage(html)
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
    if ((i + 1) % 10 === 0) console.log(`  … ${i + 1}/${targets.length} enriched (pdf ${pdfOk}, web ${webOk})`)
  }

  writeFileSync('data/enrichments.json', JSON.stringify(enrichments))
  console.log(`  ✓ data/enrichments.json — custodians for ${pdfOk}/${targets.length}, homepages for ${webOk}/${targets.length}`)

  console.log('  re-scoring with enrichment merged…')
  const { runScore } = await import('./stage2-score.js')
  await runScore()

  // snapshot of the enriched ranked set for validation
  const rescored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json', 'utf8'))
  writeFileSync('data/enriched.json', JSON.stringify(rescored.slice(0, topN)))
}
