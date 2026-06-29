'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { type Firm, fmtMoney } from '@/lib/supabase'
import { LENSES, lensScore, SIGNAL_LABELS } from '@/lib/lenses'

const US_STATES = (firms: Firm[]) =>
  Array.from(new Set(firms.map(f => f.state).filter(Boolean))).sort() as string[]

const custodianOf = (f: Firm) => f.enrichment?.custodians?.[0]?.name ?? ''

// Months since the firm's latest ADV filing — flags "gone quiet" firms.
function monthsStale(filing: string | null): number | null {
  if (!filing) return null
  const d = new Date(filing)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30))
}

type CallStatus = 'priority' | 'called' | 'skip'

// localStorage-backed call-queue state — turns the leaderboard into a working queue.
function useQueue(): [Record<number, CallStatus>, (crd: number, s: CallStatus | null) => void] {
  const [map, setMap] = useState<Record<number, CallStatus>>({})
  useEffect(() => {
    try {
      setMap(JSON.parse(localStorage.getItem('ria_queue') ?? '{}'))
    } catch {
      /* ignore */
    }
  }, [])
  const set = (crd: number, s: CallStatus | null) => {
    setMap(prev => {
      const next = { ...prev }
      if (s === null || next[crd] === s) delete next[crd]
      else next[crd] = s
      localStorage.setItem('ria_queue', JSON.stringify(next))
      return next
    })
  }
  return [map, set]
}

export function RankedTable({ firms }: { firms: Firm[] }) {
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [minAum, setMinAum] = useState(0)
  const [lensId, setLensId] = useState('balanced')
  const [hideCalled, setHideCalled] = useState(false)
  const [queue, setStatus] = useQueue()
  const [custom, setCustom] = useState<Record<string, number>>(() =>
    Object.fromEntries(LENSES[0].weights ? Object.entries(LENSES[0].weights) : []),
  )

  // On load, hydrate a shared custom lens from the URL (?w=key:val,key:val)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const w = params.get('w')
    if (w) {
      const parsed: Record<string, number> = {}
      for (const pair of w.split(',')) {
        const [k, v] = pair.split(':')
        if (k && v && !Number.isNaN(Number(v))) parsed[k] = Number(v)
      }
      if (Object.keys(parsed).length) { setCustom(parsed); setLensId('custom') }
    }
  }, [])

  const states = useMemo(() => US_STATES(firms), [firms])
  const lens =
    lensId === 'custom'
      ? { id: 'custom', label: 'Custom', blurb: 'Your weights.', weights: custom }
      : LENSES.find(l => l.id === lensId)!

  // Re-rank the whole universe under the chosen desk lens (client-side, instant).
  const ranked = useMemo(() => {
    return firms
      .map(f => ({ f, ls: lensScore(f, lens) }))
      .sort((a, b) => b.ls - a.ls)
      .map((x, i) => ({ ...x, lensRank: i + 1 }))
  }, [firms, lens])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = ranked.filter(({ f }) => {
      if (needle && !`${f.name} ${custodianOf(f)} ${f.city ?? ''}`.toLowerCase().includes(needle)) return false
      if (state && f.state !== state) return false
      if (minAum && (f.raum_total ?? 0) < minAum * 1e9) return false
      if (hideCalled && queue[f.crd] === 'called') return false
      return true
    })
    // priority firms float to top; called/skip sink — without changing the rank number
    const w = (crd: number) => (queue[crd] === 'priority' ? 0 : queue[crd] === 'called' || queue[crd] === 'skip' ? 2 : 1)
    return filtered.sort((a, b) => w(a.f.crd) - w(b.f.crd))
  }, [ranked, q, state, minAum, hideCalled, queue])

  return (
    <div>
      {/* Desk lens — the analyst's thesis made visible */}
      <div className="mb-4 bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-accent font-semibold">Rank for</span>
          {LENSES.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLensId(l.id)}
              className={`rounded-pill px-3 py-1.5 text-xs font-medium border transition-colors ${
                l.id === lensId
                  ? 'border-accent bg-accent text-white'
                  : 'border-[rgba(0,163,224,0.25)] text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {l.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLensId('custom')}
            className={`rounded-pill px-3 py-1.5 text-xs font-medium border transition-colors ${
              lensId === 'custom'
                ? 'border-gold bg-gold text-bg'
                : 'border-[rgba(200,169,110,0.4)] text-gold hover:bg-bg-elevated'
            }`}
          >
            ⚙ Custom
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">{lens.blurb}</p>

        {lensId === 'custom' && (
          <div className="mt-3 border-t border-[rgba(0,163,224,0.12)] pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {SIGNAL_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="w-40 shrink-0">{label}</span>
                  <input
                    type="range" min={0} max={40} step={1}
                    value={custom[key] ?? 0}
                    onChange={e => setCustom(c => ({ ...c, [key]: Number(e.target.value) }))}
                    className="flex-1 accent-accent"
                  />
                  <span className="font-mono w-6 text-right text-text-primary">{custom[key] ?? 0}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const w = SIGNAL_LABELS.map(s => `${s.key}:${custom[s.key] ?? 0}`).join(',')
                const url = `${window.location.origin}${window.location.pathname}?w=${w}`
                navigator.clipboard?.writeText(url)
              }}
              className="mt-3 text-xs border border-accent text-accent rounded-input px-3 py-1.5 hover:bg-bg-elevated"
            >
              Copy shareable lens link
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search firm, custodian, city…"
          className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-[rgba(0,163,224,0.35)] outline-none w-64"
        />
        <select
          value={state}
          onChange={e => setState(e.target.value)}
          className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-input px-3 py-2 text-sm text-text-secondary outline-none"
        >
          <option value="">All states</option>
          {states.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={minAum}
          onChange={e => setMinAum(Number(e.target.value))}
          className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-input px-3 py-2 text-sm text-text-secondary outline-none"
        >
          <option value={0}>Any AUM</option>
          <option value={1}>≥ $1B</option>
          <option value={5}>≥ $5B</option>
          <option value={10}>≥ $10B</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary self-center cursor-pointer">
          <input type="checkbox" checked={hideCalled} onChange={e => setHideCalled(e.target.checked)} className="accent-accent" />
          Hide called
        </label>
        <span className="font-mono text-xs text-text-muted self-center ml-auto">{rows.length} shown</span>
      </div>

      {/* mobile: card list (below sm) */}
      <div className="sm:hidden space-y-2">
        {rows.map(({ f, ls, lensRank }) => {
          const st = queue[f.crd]
          const stale = monthsStale(f.filing_date)
          return (
            <div
              key={f.crd}
              className={`bg-bg-card border rounded-card p-3 transition-colors ${
                st === 'priority' ? 'border-gold' : st ? 'opacity-50 border-[rgba(0,163,224,0.12)]' : 'border-[rgba(0,163,224,0.12)]'
              }`}
            >
              <Link href={`/firm/${f.crd}`} className="block">
                <div className="flex items-baseline justify-between">
                  <span className="text-text-primary font-medium text-sm">{f.name}</span>
                  <span className="font-mono font-semibold text-accent-bright text-sm">{Math.round(ls)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  <span className="font-mono text-text-dim">#{lensRank}</span>
                  <span>{[f.city, f.state].filter(Boolean).join(', ')}</span>
                  {stale !== null && stale >= 15 && <span className="text-warning">⚠ {stale}mo</span>}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="font-mono text-text-secondary">{fmtMoney(f.raum_total)}</span>
                  <span className="text-text-muted">{custodianOf(f) || '—'}</span>
                  <span className="font-mono text-text-secondary">{f.private_fund_count ?? '—'} funds</span>
                </div>
              </Link>
              <div className="flex gap-2 mt-2">
                <QueueBtn active={st === 'priority'} tone="gold" onClick={() => setStatus(f.crd, 'priority')}>★ Priority</QueueBtn>
                <QueueBtn active={st === 'called'} tone="muted" onClick={() => setStatus(f.crd, 'called')}>✓ Called</QueueBtn>
                <QueueBtn active={st === 'skip'} tone="muted" onClick={() => setStatus(f.crd, 'skip')}>Skip</QueueBtn>
              </div>
            </div>
          )
        })}
      </div>

      {/* desktop: table (sm and up) */}
      <div className="hidden sm:block overflow-x-auto rounded-card border border-[rgba(0,163,224,0.12)]">
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
              <th className="px-3 py-2 font-medium">Queue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, ls, lensRank }) => {
              const st = queue[f.crd]
              const stale = monthsStale(f.filing_date)
              return (
                <tr
                  key={f.crd}
                  className={`border-t border-[rgba(0,163,224,0.08)] hover:bg-bg-elevated transition-colors ${
                    st === 'priority' ? 'bg-[rgba(200,169,110,0.06)]' : st ? 'opacity-45' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-text-dim">{lensRank}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono font-semibold text-accent-bright">{Math.round(ls)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/firm/${f.crd}`} className="text-text-primary hover:text-accent font-medium">
                      {f.name}
                    </Link>
                    {stale !== null && stale >= 15 && (
                      <span className="ml-2 text-[10px] text-warning" title={`Last ADV ${stale} months ago`}>⚠ {stale}mo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{[f.city, f.state].filter(Boolean).join(', ')}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary text-right">{fmtMoney(f.raum_total)}</td>
                  <td className="px-3 py-2 text-text-muted">{custodianOf(f) || '—'}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary text-right">{f.private_fund_count ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <QueueBtn active={st === 'priority'} tone="gold" onClick={() => setStatus(f.crd, 'priority')}>★</QueueBtn>
                      <QueueBtn active={st === 'called'} tone="muted" onClick={() => setStatus(f.crd, 'called')}>✓</QueueBtn>
                      <QueueBtn active={st === 'skip'} tone="muted" onClick={() => setStatus(f.crd, 'skip')}>⊘</QueueBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QueueBtn({
  active, tone, onClick, children,
}: { active: boolean; tone: 'gold' | 'muted'; onClick: () => void; children: React.ReactNode }) {
  const base = 'rounded px-1.5 py-0.5 text-xs border transition-colors'
  const cls = active
    ? tone === 'gold'
      ? 'bg-gold text-bg border-gold'
      : 'bg-accent text-white border-accent'
    : 'border-[rgba(0,163,224,0.25)] text-text-muted hover:bg-bg-elevated'
  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  )
}
