import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { computeScore, partitionFirms } from '../src/lib/scoring.js'
import { writeRankedCsv, writeRankedHtml } from '../src/lib/report.js'
import type { AdvFirm, Enrichment, ScoredFirm } from '../src/types.js'

export async function runScore(): Promise<void> {
  console.log('stage 2 — score')
  const firms: AdvFirm[] = JSON.parse(readFileSync('data/firms.json', 'utf8'))
  const prior: { crd: number; raumTotal: number | null }[] = JSON.parse(readFileSync('data/firms-prior.json', 'utf8'))
  const meta = JSON.parse(readFileSync('data/ingest-meta.json', 'utf8'))
  const priorByCrd = new Map(prior.map(p => [p.crd, p.raumTotal]))

  // merge stage-3 enrichment when it exists (stage 3 re-runs this stage)
  const enrichments: Record<string, Enrichment> = existsSync('data/enrichments.json')
    ? JSON.parse(readFileSync('data/enrichments.json', 'utf8'))
    : {}

  const { inScope, excluded } = partitionFirms(firms)
  console.log(`  ${inScope.length.toLocaleString()} in scope · ${excluded.length.toLocaleString()} excluded (see output/excluded.csv)`)

  const scored: ScoredFirm[] = inScope
    .map(f => computeScore(f, { priorRaum: priorByCrd.get(f.crd), enrichment: enrichments[f.crd] }))
    .sort((a, b) => b.total - a.total)

  writeFileSync('data/scored.json', JSON.stringify(scored))
  writeRankedCsv(scored.slice(0, 200), excluded)
  writeRankedHtml(scored.slice(0, 100), { screened: meta.rosterTotal, snapshot: meta.snapshot })

  console.log('  ✓ data/scored.json + output/ranked-rias.{csv,html} (top 200 / top 100)')
  console.log('\n  top 10:')
  for (const [i, s] of scored.slice(0, 10).entries()) {
    const f = s.firm
    console.log(
      `   ${String(i + 1).padStart(2)}. [${s.total.toFixed(0)}] ${f.name} — ${f.city ?? '?'}, ${f.state ?? '?'} — $${(
        (f.raumTotal ?? 0) / 1e9
      ).toFixed(1)}B`,
    )
  }
}
