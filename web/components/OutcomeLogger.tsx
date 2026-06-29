'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const LABELS: Record<string, string> = {
  meeting: 'Meeting',
  won: 'Won / allocated',
  no_answer: 'No answer',
  lost: 'Lost',
  not_a_fit: 'Not a fit',
}

interface OutcomeRow {
  outcome: string
  notes: string | null
  created_at: string
}

// Read-only demo: anon writes are locked at the RLS layer, so this shows the
// logged-outcome HISTORY only. Outcomes are captured server-side / via the
// pipeline; the feedback loop nudges rank on the next run.
export function OutcomeLogger({ crd }: { crd: number }) {
  const [rows, setRows] = useState<OutcomeRow[]>([])

  useEffect(() => {
    supabase
      .from('kkr_ria_outcomes')
      .select('outcome,notes,created_at')
      .eq('crd', crd)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as OutcomeRow[]))
  }, [crd])

  return (
    <section className="mt-8 bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-xs uppercase tracking-wide text-accent font-semibold">Coverage outcomes</h3>
        <span className="font-mono text-[10px] text-text-dim">read-only demo</span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Logged call outcomes feed the scoring feedback loop — they nudge this firm&apos;s rank on the next pipeline run.
      </p>

      {rows.length > 0 ? (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="text-xs text-text-secondary flex gap-2">
              <span className="font-mono text-text-dim">{r.created_at.slice(0, 10)}</span>
              <span className="font-medium">{LABELS[r.outcome] ?? r.outcome}</span>
              {r.notes && <span className="text-text-muted">— {r.notes}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-dim">No outcomes logged for this firm yet.</p>
      )}
    </section>
  )
}
