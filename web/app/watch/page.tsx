import Link from 'next/link'
import { supabase, type Alert } from '@/lib/supabase'

export const revalidate = 120

const KIND_LABEL: Record<Alert['kind'], string> = {
  raum_jump: 'RAUM change',
  new_fund: 'New private fund',
  custodian_change: 'Custodian change',
  new_filing: 'New ADV filed',
}
const KIND_TONE: Record<Alert['kind'], string> = {
  raum_jump: 'text-accent-bright',
  new_fund: 'text-gold',
  custodian_change: 'text-accent-light',
  new_filing: 'text-text-secondary',
}

export default async function WatchPage() {
  const { data } = await supabase
    .from('kkr_ria_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  const alerts = (data ?? []) as Alert[]

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-base font-semibold text-text-primary">ADV change alerts</h2>
      <p className="text-xs text-text-muted mt-1 mb-5">
        Material changes detected on the next SEC ADV filing — RAUM jumps, new private funds, custodian moves, fresh filings.
        Public EDGAR data; refreshes when the watch job runs.
      </p>

      {alerts.length === 0 ? (
        <div className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-6 text-center">
          <p className="text-sm text-text-secondary">No changes detected yet.</p>
          <p className="text-xs text-text-muted mt-1">
            The watch job snapshots firms and alerts on the next filing that crosses a trigger
            (RAUM &gt;15%, new fund, custodian change, new ADV).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Link
              key={i}
              href={`/firm/${a.crd}`}
              className="block bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-3 hover:bg-bg-elevated transition-colors"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-text-primary font-medium text-sm">{a.name}</span>
                <span className={`text-[11px] font-medium ${KIND_TONE[a.kind]}`}>{KIND_LABEL[a.kind]}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">{a.detail}</p>
              <p className="text-[10px] text-text-dim font-mono mt-1">{a.created_at.slice(0, 10)}</p>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-[11px] text-text-dim border-t border-[rgba(0,163,224,0.08)] pt-3">
        Watchlist alerts run on public SEC EDGAR data · research demo · not investment advice.
      </p>
    </div>
  )
}
