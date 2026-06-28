'use client'

import { useState } from 'react'

// Make the grounding gate visible: this is the EXACT source text every figure in
// the brief is checked against. If a number isn't here, the gate rejects the brief.
export function SourceContext({ context }: { context: string }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs font-mono text-accent-light hover:text-accent-bright"
      >
        {open ? '▾' : '▸'} View the source data the brief is checked against
      </button>
      {open && (
        <pre className="mt-2 bg-bg-secondary border border-[rgba(139,92,246,0.12)] rounded-input p-3 text-[11px] text-text-muted whitespace-pre-wrap font-mono overflow-x-auto">
          {context}
        </pre>
      )}
      <p className="text-[11px] text-text-dim mt-1">
        Every dollar figure and percentage in the brief above must appear in this text, or the grounding gate rejects it.
      </p>
    </section>
  )
}
