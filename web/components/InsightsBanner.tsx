'use client'

import { useEffect, useState } from 'react'
import type { Firm } from '@/lib/supabase'

// Proactive "here's what matters right now" strip shown on open — turns a passive
// list into a tool that tells you where to look. Reads alert count (server),
// staleness (data), and your priority/called queue (localStorage).
export function InsightsBanner({ firms, alertCount }: { firms: Firm[]; alertCount: number }) {
  const [priority, setPriority] = useState(0)
  const [called, setCalled] = useState(0)

  useEffect(() => {
    try {
      const q = JSON.parse(localStorage.getItem('ria_queue') ?? '{}') as Record<string, string>
      const vals = Object.values(q)
      setPriority(vals.filter(v => v === 'priority').length)
      setCalled(vals.filter(v => v === 'called').length)
    } catch {
      /* ignore */
    }
  }, [])

  const stale = firms.filter(f => {
    if (!f.filing_date) return false
    const m = (Date.now() - new Date(f.filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    return m >= 15
  }).length

  const chips: { label: string; href?: string; tone: string }[] = []
  if (alertCount > 0) chips.push({ label: `${alertCount} ADV change${alertCount > 1 ? 's' : ''} to review`, href: '/watch', tone: 'text-accent-bright' })
  if (priority > 0) chips.push({ label: `${priority} priority call${priority > 1 ? 's' : ''} queued`, tone: 'text-gold' })
  if (called > 0) chips.push({ label: `${called} called this cycle`, tone: 'text-text-muted' })
  if (stale > 0) chips.push({ label: `${stale} firms gone quiet (15mo+)`, tone: 'text-warning' })

  if (chips.length === 0) return null

  return (
    <div className="mb-4 bg-bg-card border border-[rgba(0,163,224,0.18)] rounded-card px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
      <span className="text-[11px] uppercase tracking-wide text-accent font-semibold">This week</span>
      {chips.map((c, i) =>
        c.href ? (
          <a key={i} href={c.href} className={`text-xs ${c.tone} hover:underline`}>{c.label}</a>
        ) : (
          <span key={i} className={`text-xs ${c.tone}`}>{c.label}</span>
        ),
      )}
    </div>
  )
}
