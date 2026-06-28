import { AUM_BAND, DISQUALIFIERS, SIGNALS } from '../../config/scoring.js'
import type { AdvFirm, Enrichment, ExcludedFirm, ScoreComponent, ScoredFirm } from '../types.js'

const fmtMoney = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n).toLocaleString()}`
const fmtPct = (x: number) => `${Math.round(x * 100)}%`

function signal(key: string) {
  const def = SIGNALS.find(s => s.key === key)
  if (!def) throw new Error(`unknown signal ${key}`)
  return def
}

function scored(key: string, score: number, evidence: string): ScoreComponent {
  const def = signal(key)
  return { key, label: def.label, weight: def.weight, score: Math.max(0, Math.min(1, score)), evidence, status: 'scored' }
}

function missing(key: string, evidence: string): ScoreComponent {
  const def = signal(key)
  return { key, label: def.label, weight: def.weight, score: null, evidence, status: 'missing' }
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Hard disqualifiers. Returns a reason, or null if the firm is in scope. */
export function disqualify(firm: AdvFirm): string | null {
  if (firm.secStatus && !/approved/i.test(firm.secStatus)) return `SEC status: ${firm.secStatus}`
  if (firm.country && !/united states/i.test(firm.country)) return `non-US main office: ${firm.country}`
  if (
    firm.raumPooled !== null &&
    firm.raumTotal !== null &&
    firm.raumTotal > 0 &&
    firm.raumPooled / firm.raumTotal > DISQUALIFIERS.maxPooledShare
  ) {
    return `pooled-vehicle RAUM ${fmtPct(firm.raumPooled / firm.raumTotal)} of book — manufacturer, not distributor`
  }
  return null
}

/** Per-firm logged call outcomes (counts), feeding the feedback signal. */
export interface OutcomeTally {
  meeting: number
  won: number
  no_answer: number
  lost: number
  not_a_fit: number
}

// Outcome → 0..1 contribution. no_answer is neutral (ignored); it carries no signal.
const OUTCOME_VALUE: Record<keyof OutcomeTally, number | null> = {
  won: 1.0,
  meeting: 0.8,
  lost: 0.3,
  not_a_fit: 0.0,
  no_answer: null,
}

export function computeScore(
  firm: AdvFirm,
  opts: { priorRaum?: number | null; enrichment?: Enrichment; outcomes?: OutcomeTally } = {},
): ScoredFirm {
  const { priorRaum, enrichment, outcomes } = opts
  const components: ScoreComponent[] = []

  // 1. alts_exposure — 7B flag, upgraded by confirmed fund counts/types from the bulk roster
  if (firm.advisesPrivateFunds === null) {
    components.push(missing('alts_exposure', 'Item 7.B not reported'))
  } else if (!firm.advisesPrivateFunds) {
    const kicker =
      firm.pctSmaPooledVehicles !== null && firm.pctSmaPooledVehicles > 0
        ? ` (but ${firm.pctSmaPooledVehicles}% of SMA assets in unregistered pooled vehicles)`
        : ''
    components.push(scored('alts_exposure', firm.pctSmaPooledVehicles ? 0.3 : 0, `No private funds advised (7.B = N)${kicker}`))
  } else {
    const types: string[] = []
    if (firm.peFundCount) types.push(`${firm.peFundCount} PE`)
    if (firm.hedgeFundCount) types.push(`${firm.hedgeFundCount} hedge`)
    if (firm.realEstateFundCount) types.push(`${firm.realEstateFundCount} real estate`)
    const confirmed = (firm.privateFundCount ?? 0) > 0
    const gross = firm.privateFundGrossAssets ? `, ${fmtMoney(firm.privateFundGrossAssets)} gross` : ''
    components.push(
      scored(
        'alts_exposure',
        confirmed ? 1.0 : 0.7,
        confirmed
          ? `Advises ${firm.privateFundCount} private fund(s)${types.length ? ` — ${types.join(', ')}` : ''}${gross}`
          : 'Advises private funds (7.B = Y), count unconfirmed',
      ),
    )
  }

  // 2. hnw_mix — HNW RAUM share (max score at 50% mix), fallback to client-count share
  if (firm.raumHnw !== null && firm.raumTotal !== null && firm.raumTotal > 0) {
    const share = firm.raumHnw / firm.raumTotal
    components.push(scored('hnw_mix', clamp01(share / 0.5), `${fmtPct(share)} of ${fmtMoney(firm.raumTotal)} RAUM is HNW`))
  } else if (firm.clientsHnw !== null && firm.clientsIndividual !== null && firm.clientsHnw + firm.clientsIndividual > 0) {
    const share = firm.clientsHnw / (firm.clientsHnw + firm.clientsIndividual)
    components.push(scored('hnw_mix', clamp01(share / 0.5), `${fmtPct(share)} of individual clients are HNW (count fallback)`))
  } else {
    components.push(missing('hnw_mix', 'No HNW client data reported'))
  }

  // 3. aum_band — distribution view: scale = shelf space, no taper at the top
  if (firm.raumTotal === null) {
    components.push(missing('aum_band', 'Total RAUM not reported'))
  } else {
    const { rampTop, midBandTop } = AUM_BAND
    let s: number
    if (firm.raumTotal < rampTop) s = clamp01(firm.raumTotal / rampTop) * 0.5
    else if (firm.raumTotal < midBandTop) s = 0.7
    else s = 1.0
    components.push(scored('aum_band', s, `${fmtMoney(firm.raumTotal)} total RAUM`))
  }

  // 4. discretionary ratio
  if (firm.raumDiscretionary !== null && firm.raumTotal !== null && firm.raumTotal > 0) {
    const ratio = firm.raumDiscretionary / firm.raumTotal
    components.push(scored('discretionary', clamp01(ratio / 0.9), `${fmtPct(ratio)} of RAUM is discretionary`))
  } else {
    components.push(missing('discretionary', 'Discretionary split not reported'))
  }

  // 5. custodian — stage-3 enrichment only
  if (!enrichment || enrichment.custodianSource === 'none') {
    components.push(missing('custodian', 'Custodians not yet extracted (stage 3)'))
  } else if (enrichment.custodians.length === 0) {
    components.push(missing('custodian', 'No custodian names found in ADV PDF'))
  } else {
    const tier1 = enrichment.custodians.filter(c => c.tier === 1)
    const names = enrichment.custodians.map(c => c.name).join(', ')
    components.push(scored('custodian', tier1.length > 0 ? 1.0 : 0.4, `Custody: ${names}`))
  }

  // 6. aum_growth — month-over-month snapshot delta, annualized; 0 is neutral
  if (priorRaum === undefined || priorRaum === null || firm.raumTotal === null || priorRaum <= 0) {
    components.push(missing('aum_growth', 'No prior-month snapshot match'))
  } else {
    const monthly = firm.raumTotal / priorRaum - 1
    const annualized = Math.pow(1 + monthly, 12) - 1
    let s: number
    if (monthly === 0) s = 0.5 // most firms amend annually — no filing ≠ no growth
    else if (annualized <= 0) s = 0.2
    else s = clamp01(0.5 + (annualized / 0.1) * 0.5)
    const label = monthly === 0 ? 'unchanged since prior month (neutral)' : `${(annualized * 100).toFixed(1)}% annualized`
    components.push(scored('aum_growth', s, `RAUM ${label}`))
  }

  // 7. web_language — stage-3 enrichment: vehicle structures + competitor traces.
  // A competitor on the shelf is a BUY signal: the firm has already done alts onboarding.
  if (!enrichment || enrichment.websiteFetchedAt === null) {
    components.push(missing('web_language', 'Website not yet scanned (stage 3)'))
  } else {
    const structures = enrichment.structureHits
    const competitors = enrichment.competitorHits
    let s: number
    if (competitors.length > 0) s = 1.0
    else if (structures.length >= 3) s = 1.0
    else if (structures.length > 0) s = 0.6
    else s = 0
    const parts: string[] = []
    if (structures.length) parts.push(`structures: ${structures.slice(0, 4).join(', ')}`)
    if (competitors.length) parts.push(`competitor shelf traces: ${competitors.join(', ')}`)
    components.push(
      scored('web_language', s, parts.length ? `Homepage — ${parts.join(' · ')}` : 'No retail-alts vocabulary on homepage'),
    )
  }

  // 8. feedback — logged call outcomes nudge the rank. Neutral (missing) until
  // outcomes exist, so it never penalizes un-contacted firms. Averages the
  // value of all signal-bearing outcomes (no_answer ignored).
  if (!outcomes) {
    components.push(missing('feedback', 'No call outcomes logged yet'))
  } else {
    const keys = Object.keys(OUTCOME_VALUE) as (keyof OutcomeTally)[]
    let weightedSum = 0
    let n = 0
    for (const k of keys) {
      const v = OUTCOME_VALUE[k]
      if (v === null) continue
      const c = outcomes[k] ?? 0
      weightedSum += v * c
      n += c
    }
    if (n === 0) {
      components.push(missing('feedback', 'Only no-answer outcomes — no signal yet'))
    } else {
      const parts = keys.filter(k => (outcomes[k] ?? 0) > 0).map(k => `${outcomes[k]} ${k}`)
      components.push(scored('feedback', clamp01(weightedSum / n), `Coverage outcomes: ${parts.join(', ')}`))
    }
  }

  const available = components.filter(c => c.status === 'scored')
  const availableWeight = available.reduce((a, c) => a + c.weight, 0)
  const totalWeight = components.reduce((a, c) => a + c.weight, 0)
  const total = availableWeight > 0 ? (available.reduce((a, c) => a + (c.score ?? 0) * c.weight, 0) / availableWeight) * 100 : 0

  return {
    firm,
    total: Math.round(total * 10) / 10,
    components,
    dataCompleteness: Math.round((availableWeight / totalWeight) * 100) / 100,
    enrichment,
  }
}

export function partitionFirms(firms: AdvFirm[]): { inScope: AdvFirm[]; excluded: ExcludedFirm[] } {
  const inScope: AdvFirm[] = []
  const excluded: ExcludedFirm[] = []
  for (const firm of firms) {
    const reason = disqualify(firm)
    if (reason) excluded.push({ crd: firm.crd, name: firm.name, reason })
    else inScope.push(firm)
  }
  return { inScope, excluded }
}
