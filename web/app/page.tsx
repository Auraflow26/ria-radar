import { supabase, type Firm } from '@/lib/supabase'
import { RankedTable } from '@/components/RankedTable'
import { InsightsBanner } from '@/components/InsightsBanner'
import { GuidedTour } from '@/components/GuidedTour'

export const revalidate = 300 // refresh from DB every 5 min

export default async function HomePage() {
  const [{ data, error }, { count }] = await Promise.all([
    supabase.from('kkr_ria_firms').select('*').order('rank', { ascending: true }).limit(150),
    supabase.from('kkr_ria_alerts').select('*', { count: 'exact', head: true }),
  ])

  if (error) {
    return <p className="text-danger font-mono text-sm">Failed to load firms: {error.message}</p>
  }
  const firms = (data ?? []) as Firm[]

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <h2 className="text-base font-semibold text-text-primary">Your call queue</h2>
        <span className="font-mono text-xs text-text-muted">{firms.length} firms</span>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Pick a desk lens to re-rank · ★ priority / ✓ called / ⊘ skip to work the queue · click a firm for its grounded brief · or ask the Research Guide (bottom-right).
      </p>
      <InsightsBanner firms={firms} alertCount={count ?? 0} />
      <RankedTable firms={firms} />
      <GuidedTour />
    </div>
  )
}
