import { z } from 'zod'

/**
 * One SEC-registered RIA, normalized from the monthly FOIA roster CSV.
 * Every numeric field is `number | null` — the parser never invents zeros.
 */
export const AdvFirmSchema = z.object({
  crd: z.number().int(),
  name: z.string(),
  legalName: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  filingDate: z.string().nullable(), // MM/DD/YYYY as filed
  secStatus: z.string().nullable(),
  employees: z.number().nullable(), // 5A
  raumTotal: z.number().nullable(), // 5F(2)(c)
  raumDiscretionary: z.number().nullable(), // 5F(2)(a)
  raumNonDiscretionary: z.number().nullable(), // 5F(2)(b)
  clientsIndividual: z.number().nullable(), // 5D(a)(1)
  raumIndividual: z.number().nullable(), // 5D(a)(3)
  clientsHnw: z.number().nullable(), // 5D(b)(1)
  raumHnw: z.number().nullable(), // 5D(b)(3)
  clientsPooled: z.number().nullable(), // 5D(f)(1)
  raumPooled: z.number().nullable(), // 5D(f)(3)
  advisesPrivateFunds: z.boolean().nullable(), // 7B
  privateFundCount: z.number().nullable(), // Count of Private Funds - 7B(1)
  peFundCount: z.number().nullable(), // Total number of PE funds
  hedgeFundCount: z.number().nullable(),
  realEstateFundCount: z.number().nullable(),
  privateFundGrossAssets: z.number().nullable(),
  pctSmaPooledVehicles: z.number().nullable(), // 5.K.(1)(a)(x) end year %
})
export type AdvFirm = z.infer<typeof AdvFirmSchema>

export type ComponentStatus = 'scored' | 'missing'

export interface ScoreComponent {
  key: string
  label: string
  weight: number
  /** 0–1 component score; null when status is "missing" */
  score: number | null
  /** Human-readable evidence, e.g. "72% of $4.2B RAUM is HNW" */
  evidence: string
  status: ComponentStatus
}

export interface ScoredFirm {
  firm: AdvFirm
  /** 0–100, weighted over available components only */
  total: number
  components: ScoreComponent[]
  /** Share of total weight that had data behind it */
  dataCompleteness: number
  enrichment?: Enrichment
}

export interface FundDetail {
  peFunds: number | null
  privateCreditFunds: number | null
  realEstateFunds: number | null
  hedgeFunds: number | null
  totalPrivateFundGrossAssets: number | null
}

export interface Enrichment {
  custodians: { name: string; tier: 1 | 2; platformNote?: string }[]
  /** 'adv-pdf' = live latest filing; 'bulk-2024-12' = stale SEC structured data (caveat required) */
  custodianSource: 'adv-pdf' | 'bulk-2024-12' | 'none'
  /** Private-fund detail parsed from Schedule D 7.B of the live ADV PDF */
  fundDetail?: FundDetail
  /** Evergreen/retail-alts vehicle structures found on the firm homepage */
  structureHits: string[]
  /** Competing alts managers found on the firm homepage (a BUY signal) */
  competitorHits: string[]
  websiteFetchedAt: string | null
}

export interface ExcludedFirm {
  crd: number
  name: string
  reason: string
}

/** Claude's brief output — constrained by the forced tool schema. */
export const FirmBriefSchema = z.object({
  positioning_summary: z.string(),
  alts_readiness_bullets: z.array(z.string()).min(2).max(5),
  current_alts_footprint: z.string(),
  suggested_angle: z.string(),
  conversation_starters: z.array(z.string()).length(3),
  caveats: z.array(z.string()).min(1),
})
export type FirmBrief = z.infer<typeof FirmBriefSchema>
