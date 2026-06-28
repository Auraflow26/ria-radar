'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { type Firm, fmtMoney } from '@/lib/supabase'
import { LENSES, lensScore } from '@/lib/lenses'

const US_STATES = (firms: Firm[]) =>
  Array.from(new Set(firms.map(f => f.state).filter(Boolean))).sort() as string[]

const custodianOf = (f: Firm) => f.enrichment?.custodians?.[0]?.name ?? ''

export function RankedTable({ firms }: { firms: Firm[] }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [minAum, setMinAum] = useState(0)
  const [lensId, setLensId] = useState('balanced')

  const states = useMemo(() => US_STATES(firms), [firms])
  const lens = LENSES.find(l => l.id === lensId)!

  // Re-rank the whole universe under the chosen desk lens (client-side, instant).
  const ranked = useMemo(() => {
    return firms
      .map(f => ({ f, ls: lensScore(f, lens) }))
      .sort((a, b) => b.ls - a.ls)
      .map((x, i) => ({ ...x, lensRank: i + 1 }))
  }, [firms, lens])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ranked.filter(({ f }) => {
      if (needle && !`${f.name} ${custodianOf(f)} ${f.city ?? ''}`.toLowerCase().includes(needle)) return false
      if (state && f.state !== state) return false
      if (minAum && (f.raum_total ?? 0) < minAum * 1e9) return false
      return true
    })
  }, [ranked, q, state, minAum])

  return (
    <div>
      {/* Desk lens — the analyst's thesis made visible */}
      <div className="mb-4 bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-accent font-semibold">Rank for</span>
          {LENSES.map(l => (
            <button
              key={l.id}
              onClick={() => setLensId(l.id)}
              className={`rounded-pill px-3 py-1.5 text-xs font-medium border transition-colors ${
                l.id === lensId
                  ? 'border-accent bg-accent text-white'
                  : 'border-[rgba(139,92,246,0.25)] text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2">{lens.blurb}</p>
      </div>

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
            {rows.map(({ f, ls, lensRank }) => (
              <tr
                key={f.crd}
                className="border-t border-[rgba(139,92,246,0.08)] hover:bg-bg-elevated transition-colors"
              >
                <td className="px-3 py-2 font-mono text-text-dim">{lensRank}</td>
                <td className="px-3 py-2">
                  <span className="font-mono font-semibold text-accent-bright">{Math.round(ls)}</span>
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
