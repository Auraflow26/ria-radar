'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { type Firm, fmtMoney } from '@/lib/supabase'

const US_STATES = (firms: Firm[]) =>
  Array.from(new Set(firms.map(f => f.state).filter(Boolean))).sort() as string[]

const custodianOf = (f: Firm) => f.enrichment?.custodians?.[0]?.name ?? ''

export function RankedTable({ firms }: { firms: Firm[] }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [minAum, setMinAum] = useState(0)

  const states = useMemo(() => US_STATES(firms), [firms])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return firms.filter(f => {
      if (needle && !`${f.name} ${custodianOf(f)} ${f.city ?? ''}`.toLowerCase().includes(needle)) return false
      if (state && f.state !== state) return false
      if (minAum && (f.raum_total ?? 0) < minAum * 1e9) return false
      return true
    })
  }, [firms, q, state, minAum])

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search firm, custodian, city…"
          className="bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-[rgba(139,92,246,0.35)] outline-none w-64"
        />
        <select
          value={state}
          onChange={e => setState(e.target.value)}
          className="bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-input px-3 py-2 text-sm text-text-secondary outline-none"
        >
          <option value="">All states</option>
          {states.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={minAum}
          onChange={e => setMinAum(Number(e.target.value))}
          className="bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-input px-3 py-2 text-sm text-text-secondary outline-none"
        >
          <option value={0}>Any AUM</option>
          <option value={1}>≥ $1B</option>
          <option value={5}>≥ $5B</option>
          <option value={10}>≥ $10B</option>
        </select>
        <span className="font-mono text-xs text-text-muted self-center ml-auto">{rows.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-card border border-[rgba(139,92,246,0.12)]">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-muted">
            <tr className="text-left">
              <th className="px-3 py-2 font-mono font-medium">#</th>
              <th className="px-3 py-2 font-mono font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Firm</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-mono font-medium text-right">RAUM</th>
              <th className="px-3 py-2 font-medium">Custodian</th>
              <th className="px-3 py-2 font-mono font-medium text-right">Funds</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(f => (
              <tr
                key={f.crd}
                className="border-t border-[rgba(139,92,246,0.08)] hover:bg-bg-elevated transition-colors"
              >
                <td className="px-3 py-2 font-mono text-text-dim">{f.rank}</td>
                <td className="px-3 py-2">
                  <span className="font-mono font-semibold text-accent-bright">{Math.round(f.score)}</span>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/firm/${f.crd}`} className="text-text-primary hover:text-accent-light font-medium">
                    {f.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-text-muted">{[f.city, f.state].filter(Boolean).join(', ')}</td>
                <td className="px-3 py-2 font-mono text-text-secondary text-right">{fmtMoney(f.raum_total)}</td>
                <td className="px-3 py-2 text-text-muted">{custodianOf(f) || '—'}</td>
                <td className="px-3 py-2 font-mono text-text-secondary text-right">{f.private_fund_count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
