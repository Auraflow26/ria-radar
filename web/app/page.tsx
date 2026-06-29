import { supabase, type Firm } from '@/lib/supabase'
import { RankedTable } from '@/components/RankedTable'

export const revalidate = 300 // refresh from DB every 5 min

export default async function HomePage() {
  const { data, error } = await supabase
    .from('kkr_ria_firms')
    .select('*')
    .order('rank', { ascending: true })
    .limit(150)

  if (error) {
    return <p className="text-danger font-mono text-sm">Failed to load firms: {error.message}</p>
  }
  const firms = (data ?? []) as Firm[]

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-base font-semibold text-text-primary">Ranked call list</h2>
        <span className="font-mono text-xs text-text-muted">{firms.length} firms</span>
      </div>
      <RankedTable firms={firms} />
    </div>
  )
}
