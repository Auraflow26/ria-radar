import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { computeScore, partitionFirms } from '../src/lib/scoring.js'
import { LIST_TOP_N } from '../config/scoring.js'
import { writeRankedCsv, writeRankedHtml } from '../src/lib/report.js'
import { persistRankedFirms, hasSupabase, fetchOutcomeTallies } from '../src/lib/persist.js'
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

  // feedback loop: tally logged call outcomes (empty when Supabase unconfigured → neutral)
  const outcomes = await fetchOutcomeTallies()
  const nFb = Object.keys(outcomes).length
  if (nFb) console.log(`  feedback: ${nFb} firm(s) have logged outcomes nudging the score`)

  const scored: ScoredFirm[] = inScope
    .map(f => computeScore(f, { priorRaum: priorByCrd.get(f.crd), enrichment: enrichments[f.crd], outcomes: outcomes[f.crd] }))
    // deterministic order: score, then RAUM, then CRD — stable across re-runs, no arbitrary ties
    .sort((a, b) => b.total - a.total || (b.firm.raumTotal ?? 0) - (a.firm.raumTotal ?? 0) || a.firm.crd - b.firm.crd)

  writeFileSync('data/scored.json', JSON.stringify(scored))
  writeRankedCsv(scored.slice(0, LIST_TOP_N), excluded)
  writeRankedHtml(scored.slice(0, Math.min(LIST_TOP_N, 200)), { screened: meta.rosterTotal, snapshot: meta.snapshot })

  console.log('  ✓ data/scored.json + output/ranked-rias.{csv,html} (top 200 / top 100)')

  // [KKR-RIA] persist ranked firms to Supabase (opt-in; no-op when SUPABASE_* unset)
  if (hasSupabase()) {
    try {
      const n = await persistRankedFirms(scored.slice(0, LIST_TOP_N), meta.snapshot)
      console.log(`  ✓ persisted ${n} ranked firms → Supabase (kkr_ria_firms)`)
    } catch (err) {
      console.warn(`  ⚠ Supabase persist failed (continuing file-only): ${(err as Error).message}`)
    }
  }
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
