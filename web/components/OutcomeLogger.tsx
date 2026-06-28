'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const OUTCOMES: { key: string; label: string; tone: string }[] = [
  { key: 'meeting', label: 'Meeting', tone: 'border-accent text-accent-light' },
  { key: 'won', label: 'Won / allocated', tone: 'border-success text-success' },
  { key: 'no_answer', label: 'No answer', tone: 'border-text-dim text-text-muted' },
  { key: 'lost', label: 'Lost', tone: 'border-warning text-warning' },
  { key: 'not_a_fit', label: 'Not a fit', tone: 'border-danger text-danger' },
]

interface OutcomeRow {
  outcome: string
  notes: string | null
  created_at: string
}

export function OutcomeLogger({ crd }: { crd: number }) {
  const [rows, setRows] = useState<OutcomeRow[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase
      .from('kkr_ria_outcomes')
      .select('outcome,notes,created_at')
      .eq('crd', crd)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as OutcomeRow[])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crd])

  async function log(outcome: string) {
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('kkr_ria_outcomes').insert({ crd, outcome, notes: notes || null })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setNotes('')
    load()
  }

  const label = (k: string) => OUTCOMES.find(o => o.key === k)?.label ?? k

  return (
    <section className="mt-8 bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-card p-4">
      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mb-1">Log a call outcome</h3>
      <p className="text-xs text-text-muted mb-3">
        Feeds the scoring feedback loop — outcomes nudge this firm&apos;s rank on the next pipeline run.
      </p>
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional note…"
        className="w-full bg-bg-secondary border border-[rgba(139,92,246,0.12)] rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none mb-3"
      />
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map(o => (
          <button
            key={o.key}
            disabled={busy}
            onClick={() => log(o.key)}
            className={`border ${o.tone} bg-transparent rounded-pill px-3 py-1.5 text-xs font-medium hover:bg-bg-elevated transition-colors disabled:opacity-50`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {err && <p className="text-danger text-xs mt-2 font-mono">{err}</p>}

      {rows.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[10px] uppercase tracking-wide text-text-muted mb-2">History ({rows.length})</h4>
          <ul className="space-y-1">
            {rows.map((r, i) => (
              <li key={i} className="text-xs text-text-secondary flex gap-2">
                <span className="font-mono text-text-dim">{r.created_at.slice(0, 10)}</span>
                <span className="font-medium">{label(r.outcome)}</span>
                {r.notes && <span className="text-text-muted">— {r.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
