// [KKR-RIA] Map pipeline outputs → Supabase rows and upsert them.
// Auraflow technique: the DB stores the same structured objects the app reads,
// JSONB for the explainable breakdown, natural-key (CRD) upsert for idempotency.

import { hasSupabase, upsert } from './supabase-client.js'
import type { FirmBrief, ScoredFirm } from '../types.js'

export { hasSupabase }

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
