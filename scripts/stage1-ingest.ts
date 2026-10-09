import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolveMonthlySources } from '../src/lib/monthly-sources.js'
import { INGEST_FILTER } from '../config/scoring.js'
import { fetchMonthlyRoster } from '../src/lib/sec-client.js'
import { parseRosterCsv } from '../src/lib/adv-parser.js'
import type { AdvFirm } from '../src/types.js'

/** Loose pre-filter: keep wealth-channel-sized US firms with retail clients. */
function inIngestScope(f: AdvFirm): boolean {
  if (f.raumTotal === null) return false
  if (f.raumTotal < INGEST_FILTER.minRaum || f.raumTotal > INGEST_FILTER.maxRaum) return false
  const hasRetail = (f.clientsIndividual ?? 0) > 0 || (f.clientsHnw ?? 0) > 0
  return hasRetail
}

export async function runIngest(opts: { withBulk?: boolean } = {}): Promise<void> {
  const { current: CURRENT_MONTH, prior: PRIOR_MONTH } = await resolveMonthlySources()
  console.log(`stage 1 — ingest (${CURRENT_MONTH.label} + ${PRIOR_MONTH.label})`)

  const currentCsv = await fetchMonthlyRoster(CURRENT_MONTH)
  const all = await parseRosterCsv(currentCsv)
  const firms = all.filter(inIngestScope)
  console.log(`  ${all.length.toLocaleString()} firms in roster → ${firms.length.toLocaleString()} in ingest scope`)

  const priorCsv = await fetchMonthlyRoster(PRIOR_MONTH)
  const priorAll = await parseRosterCsv(priorCsv)
  // prior snapshot only needs CRD → RAUM for the growth join
  const prior = priorAll.map(f => ({ crd: f.crd, raumTotal: f.raumTotal }))

  mkdirSync('data', { recursive: true })
  writeFileSync('data/firms.json', JSON.stringify(firms))
  writeFileSync('data/firms-prior.json', JSON.stringify(prior))
  writeFileSync(
    'data/ingest-meta.json',
    JSON.stringify({ snapshot: CURRENT_MONTH.label, prior: PRIOR_MONTH.label, rosterTotal: all.length, inScope: firms.length, acquiredAt: JSON.parse(readFileSync(`data/raw/${CURRENT_MONTH.label}.receipt.json`, 'utf8')).fetchedAt, currentSource: CURRENT_MONTH.url, priorSource: PRIOR_MONTH.url }),
  )
  console.log(`  ✓ data/firms.json (${firms.length.toLocaleString()}) + data/firms-prior.json (${prior.length.toLocaleString()})`)

  if (opts.withBulk) {
    console.log('  --with-bulk: building SEC structured Schedule D index (~1.4GB, STALE thru 2024-12)…')
    const { buildBulkIndex } = await import('../src/lib/adv-bulk.js')
    await buildBulkIndex() // writes data/schedule-d-bulk.json; stage 3 joins it as a fallback
  }
}
