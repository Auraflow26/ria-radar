// [KKR-RIA] Map pipeline outputs → Supabase rows and upsert them.
// Auraflow technique: the DB stores the same structured objects the app reads,
// JSONB for the explainable breakdown, natural-key (CRD) upsert for idempotency.

import { hasSupabase, upsert, selectAll } from './supabase-client.js'
import type { FirmBrief, ScoredFirm } from '../types.js'
import type { OutcomeTally } from './scoring.js'

export { hasSupabase }

const EMPTY_TALLY = (): OutcomeTally => ({ meeting: 0, won: 0, no_answer: 0, lost: 0, not_a_fit: 0 })

/**
 * Pull logged call outcomes and tally them per firm (CRD → counts). Returns an
 * empty map when Supabase is unconfigured — the feedback signal then stays
 * neutral for every firm. Read-only; safe in any run.
 */
export async function fetchOutcomeTallies(): Promise<Record<number, OutcomeTally>> {
  if (!hasSupabase()) return {}
  const rows = await selectAll<{ crd: number; outcome: keyof OutcomeTally }>('kkr_ria_outcomes', 'crd,outcome')
  const map: Record<number, OutcomeTally> = {}
  for (const r of rows) {
    const t = (map[r.crd] ??= EMPTY_TALLY())
    if (r.outcome in t) t[r.outcome]++
  }
  return map
}

/** Upsert the ranked firm list. No-op when Supabase is unconfigured. */
export async function persistRankedFirms(ranked: ScoredFirm[], snapshot: string): Promise<number> {
  if (!hasSupabase()) return 0
  const rows = ranked.map((r, i) => {
    const f = r.firm
    return {
      crd: f.crd,
      run_snapshot: snapshot,
      rank: i + 1,
      score: r.total,
      data_completeness: r.dataCompleteness,
      name: f.name,
      city: f.city ?? null,
      state: f.state ?? null,
      website: f.website ?? null,
      raum_total: f.raumTotal,
      raum_discretionary: f.raumDiscretionary,
      raum_hnw: f.raumHnw,
      employees: f.employees ?? null,
      private_fund_count: f.privateFundCount ?? null,
      filing_date: f.filingDate ?? null,
      components: r.components,
      enrichment: r.enrichment ?? null,
    }
  })
  await upsert('kkr_ria_firms', rows, 'crd')
  return rows.length
}

/** Upsert one generated brief keyed by CRD. No-op when Supabase is unconfigured. */
export async function persistBrief(
  crd: number,
  rank: number,
  brief: FirmBrief,
  sourceContext: string,
  meta: { model: string; grounded: boolean },
): Promise<void> {
  if (!hasSupabase()) return
  await upsert(
    'kkr_ria_briefs',
    [
      {
        crd,
        rank,
        model: meta.model,
        grounded: meta.grounded,
        brief,
        source_context: sourceContext,
      },
    ],
    'crd',
  )
}
