import { createClient } from '@supabase/supabase-js'

// Public read-only client. The publishable key is safe to ship to the browser;
// RLS allows anon SELECT on kkr_ria_* (public SEC data) and nothing else.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(url, key, { auth: { persistSession: false } })

export interface ScoreComponent {
  key: string
  label: string
  score: number | null
  status: 'scored' | 'missing'
  evidence: string
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
  custodianSource: string
  fundDetail?: FundDetail
  structureHits: string[]
  competitorHits: string[]
  websiteFetchedAt: string | null
}

export interface Firm {
  crd: number
  run_snapshot: string
  rank: number
  score: number
  data_completeness: number
  name: string
  city: string | null
  state: string | null
  website: string | null
  raum_total: number | null
  raum_discretionary: number | null
  raum_hnw: number | null
  employees: number | null
  private_fund_count: number | null
  filing_date: string | null
  components: ScoreComponent[]
  enrichment: Enrichment | null
}

export interface Brief {
  crd: number
  rank: number
  model: string
  grounded: boolean
  brief: {
    positioning_summary: string
    alts_readiness_bullets: string[]
    current_alts_footprint: string
    suggested_angle: string
    conversation_starters: string[]
    caveats: string[]
  }
  source_context: string
}

export interface Alert {
  crd: number
  name: string
  kind: 'raum_jump' | 'new_fund' | 'custodian_change' | 'new_filing'
  detail: string
  created_at: string
}

export const fmtMoney = (n: number | null) =>
  n === null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`
