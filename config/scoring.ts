/**
 * The scoring model — single source of truth.
 * The scorer, CSV, HTML report, and README all render from this table.
 * Weights renormalize over available signals; a missing signal never
 * penalizes a firm, it just lowers data-completeness.
 */

export interface SignalDef {
  key: string
  label: string
  weight: number
  /** Where the number comes from (shown in report tooltips + README) */
  source: string
  /** The one-line rationale a distribution MD hears */
  rationale: string
}

export const SIGNALS: SignalDef[] = [
  {
    key: 'alts_exposure',
    label: 'Existing private-fund / alts exposure',
    weight: 25,
    source: 'Form ADV Item 7.B + private fund type counts (bulk roster)',
    rationale:
      'Firms already running private vehicles have done the operational and diligence work — shortest path to a first allocation.',
  },
  {
    key: 'hnw_mix',
    label: 'High-net-worth client mix',
    weight: 30,
    source: 'Item 5.D(b)(3) HNW RAUM ÷ 5.F(2)(c) total RAUM',
    rationale:
      'Evergreen and semi-liquid products need qualified HNW books; mass-affluent-only firms cannot allocate.',
  },
  {
    key: 'aum_band',
    label: 'AUM scale',
    weight: 15,
    source: 'Item 5.F(2)(c) total regulatory AUM',
    rationale:
      'Distribution targets scale with shelf space — a $20B aggregator rolling out a model allocation moves more than a hundred small firms.',
  },
  {
    key: 'discretionary',
    label: 'Discretionary ratio',
    weight: 10,
    source: 'Item 5.F(2)(a) ÷ 5.F(2)(c)',
    rationale:
      'A discretionary book means the advisor can implement a model allocation across hundreds of households at once.',
  },
  {
    key: 'custodian',
    label: 'Custodian platform access',
    weight: 10,
    source: 'Schedule D 5.K(3) custodian names (per-firm ADV PDF)',
    rationale:
      'Custody at the major platforms means the operational rails for alt-product distribution already exist.',
  },
  {
    key: 'aum_growth',
    label: 'AUM growth',
    weight: 5,
    source: 'Total RAUM, current vs prior monthly snapshot (CRD join)',
    rationale:
      'Growing firms are adding advisors and products; growth correlates with openness to new shelf space.',
  },
  {
    key: 'web_language',
    label: 'Website alts language',
    weight: 5,
    source: 'Firm homepage keyword scan',
    rationale:
      'They already market private-markets capability — a warm conversation, not an education call.',
  },
]

/** Loose ingest filter (scoring bands are narrower than this). */
export const INGEST_FILTER = {
  minRaum: 500_000_000,
  maxRaum: 50_000_000_000,
}

/** Hard disqualifiers — excluded with a reason, listed in excluded.csv. */
export const DISQUALIFIERS = {
  /** Pooled-vehicle RAUM above this share = manufacturer, not distributor */
  maxPooledShare: 0.5,
}

/**
 * AUM scale scoring breakpoints (signal: aum_band).
 * Distribution view: no taper at the top — mega-aggregators are prime
 * coverage targets, not too-big-to-need-us.
 */
export const AUM_BAND = {
  rampTop: 1_000_000_000, // below this, score ramps toward 0.5
  midBandTop: 5_000_000_000, // $1–5B scores 0.7
  // ≥ $5B scores 1.0
}

export const BRIEF_TOP_N_DEFAULT = 10
export const ENRICH_TOP_N_DEFAULT = 75
