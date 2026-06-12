/**
 * Custodian keyword dictionary for Schedule D 5.K.(3) text matching.
 *
 * Tier 1 custodians operate established alternatives marketplaces
 * (Schwab Alternative Investment Marketplace, Fidelity alternative
 * investments platform, Pershing/BNY Alts Bridge) — public fact, and the
 * operational rails a distribution team cares about. This repo makes NO
 * claims about which specific products are approved on which platform;
 * that is firm-internal data.
 */

export interface CustodianPattern {
  name: string
  tier: 1 | 2
  patterns: RegExp[]
  /** Public, verifiable platform note shown in briefs */
  platformNote?: string
}

export const CUSTODIANS: CustodianPattern[] = [
  {
    name: 'Charles Schwab',
    tier: 1,
    patterns: [/charles schwab/i, /\bschwab\b/i],
    platformNote: 'Operates the Schwab Alternative Investment Marketplace',
  },
  {
    name: 'Fidelity',
    tier: 1,
    patterns: [/fidelity/i, /national financial services/i, /\bNFS\b/],
    platformNote: 'Operates an alternative investments platform for advisors',
  },
  {
    name: 'Pershing (BNY)',
    tier: 1,
    patterns: [/pershing/i, /bank of new york/i, /\bBNY\b/],
    platformNote: 'BNY Pershing offers the Alts Bridge platform',
  },
  { name: 'LPL Financial', tier: 2, patterns: [/LPL financial/i] },
  { name: 'Raymond James', tier: 2, patterns: [/raymond james/i] },
  { name: 'Interactive Brokers', tier: 2, patterns: [/interactive brokers/i] },
  { name: 'Goldman Sachs Custody', tier: 2, patterns: [/goldman sachs/i] },
  { name: 'Axos', tier: 2, patterns: [/\baxos\b/i] },
  { name: 'Altruist', tier: 2, patterns: [/altruist/i] },
  { name: 'State Street', tier: 2, patterns: [/state street/i] },
  { name: 'US Bank', tier: 2, patterns: [/u\.?s\.? bank/i] },
  { name: 'Northern Trust', tier: 2, patterns: [/northern trust/i] },
]

/**
 * Retail-alts vocabulary scanned on firm homepages — split into the vehicle
 * structures KKR's evergreen suite actually uses, and competitor asset
 * managers already on the firm's shelf (a competitor trace is a BUY signal
 * for distribution: the firm has done alts onboarding before).
 */
export const ALTS_STRUCTURE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'interval fund', pattern: /interval\s*fund/i },
  { label: 'tender offer fund', pattern: /tender[\s-]*offer/i },
  { label: 'BDC', pattern: /\bBDC\b|business\s*development\s*compan/i },
  { label: 'evergreen fund', pattern: /evergreen\s*(fund|structure|vehicle)/i },
  { label: 'continuously offered', pattern: /continuously\s*offered/i },
  { label: 'DST', pattern: /delaware\s*statutory\s*trust|\bDSTs?\b/ },
  { label: 'liquid alts', pattern: /liquid\s*alts/i },
  { label: 'non-traded REIT', pattern: /non[\s-]*traded\s*REIT/i },
  { label: 'private markets', pattern: /private\s*markets?\b/i },
  { label: 'private equity', pattern: /private\s*equity/i },
  { label: 'private credit', pattern: /private\s*credit/i },
  { label: 'qualified purchaser', pattern: /qualified\s*purchaser/i },
  { label: 'accredited investor', pattern: /accredited\s*investor/i },
]

export const COMPETITOR_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'Blackstone', pattern: /blackstone/i },
  { label: 'BREIT', pattern: /\bBREIT\b/ },
  { label: 'BCRED', pattern: /\bBCRED\b/ },
  { label: 'Apollo', pattern: /\bapollo\b/i },
  { label: 'Blue Owl', pattern: /blue\s*owl/i },
  { label: 'Ares', pattern: /\bares\b/i },
  { label: 'Cliffwater', pattern: /cliffwater/i },
  { label: 'Hamilton Lane', pattern: /hamilton\s*lane/i },
  { label: 'StepStone', pattern: /stepstone/i },
  { label: 'iCapital', pattern: /icapital/i },
  { label: 'CAIS', pattern: /\bCAIS\b/ },
]
