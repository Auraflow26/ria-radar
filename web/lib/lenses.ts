// Desk lenses — the same 2,081-firm universe, re-ranked by what each coverage
// desk actually cares about. This is the analyst's thesis made visible: a credit
// wholesaler and a PE wholesaler should NOT call the same firms first.
//
// A lens is a set of per-signal weights. We recompute each firm's composite from
// its already-scored components (client-side, instant) — no pipeline re-run.

import type { Firm } from './supabase'

export interface Lens {
  id: string
  label: string
  blurb: string
  weights: Record<string, number> // signal key → weight
}

// Base weights mirror the committed scoring model (the "balanced" house view).
export const LENSES: Lens[] = [
  {
    id: 'balanced',
    label: 'Balanced (house view)',
    blurb: 'The default committed model — broad alts-readiness.',
    weights: {
      alts_exposure: 28, hnw_mix: 30, aum_band: 25, discretionary: 4,
      custodian: 9, aum_growth: 2, web_language: 2, feedback: 5,
    },
  },
  {
    id: 'credit',
    label: 'Private credit desk',
    blurb: 'Leans on existing private-fund machinery and custody rails; HNW matters less than operational readiness.',
    weights: {
      alts_exposure: 38, custodian: 18, discretionary: 12, hnw_mix: 14,
      aum_band: 10, web_language: 4, aum_growth: 2, feedback: 5,
    },
  },
  {
    id: 'pe',
    label: 'Private equity desk',
    blurb: 'Qualified-purchaser HNW books that can hold illiquid PE; scale = shelf space.',
    weights: {
      hnw_mix: 38, aum_band: 24, alts_exposure: 20, discretionary: 6,
      custodian: 4, web_language: 2, aum_growth: 2, feedback: 5,
    },
  },
  {
    id: 'realestate',
    label: 'Real estate / income desk',
    blurb: 'Income-oriented HNW with discretionary implementation and a marketed alts shelf.',
    weights: {
      hnw_mix: 30, discretionary: 18, web_language: 14, alts_exposure: 16,
      aum_band: 10, custodian: 5, aum_growth: 2, feedback: 5,
    },
  },
]

/** Recompute a firm's composite (0–100) under a lens, renormalizing over the
 *  signals that actually have data — same rule as the pipeline scorer. */
export function lensScore(firm: Firm, lens: Lens): number {
  let num = 0
  let den = 0
  for (const c of firm.components) {
    const w = lens.weights[c.key] ?? 0
    if (w === 0) continue
    if (c.status === 'missing' || c.score === null) continue
    num += c.score * w
    den += w
  }
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0
}
