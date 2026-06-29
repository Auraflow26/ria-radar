'use client'

import { useEffect, useState } from 'react'

const KEY = 'ria_onboarded_v1'

export function Onboarding() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true)
  }, [])
  if (!show) return null

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setShow(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={dismiss}>
      <div className="w-full max-w-md bg-bg-elevated border border-[rgba(139,92,246,0.3)] rounded-card p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-text-primary">Welcome to RIA Radar</h2>
        <p className="text-sm text-text-secondary mt-2">
          Every US wealth-channel RIA, scored on alternatives-readiness from public SEC filings. Not a list to buy —
          a ranked call sheet with the reasoning attached. Three things make it different:
        </p>
        <ul className="mt-4 space-y-3">
          <li className="flex gap-3">
            <span className="text-accent-bright font-mono text-sm">1</span>
            <span className="text-sm text-text-secondary"><strong className="text-text-primary">Re-ranks by desk.</strong> Use the &quot;Rank for&quot; buttons — a credit desk and a PE desk see a different order.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent-bright font-mono text-sm">2</span>
            <span className="text-sm text-text-secondary"><strong className="text-text-primary">Briefs that can&apos;t lie.</strong> Every figure is checked against the filing — open any top-75 firm to see it, with &quot;view source data.&quot;</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent-bright font-mono text-sm">3</span>
            <span className="text-sm text-text-secondary"><strong className="text-text-primary">Ask the guide.</strong> The chat button (bottom-right) answers data questions and explains how it all works.</span>
          </li>
        </ul>
        <button onClick={dismiss} className="mt-6 w-full bg-accent text-white rounded-input px-3 py-2 text-sm font-medium hover:bg-accent-light transition-colors">
          Start exploring
        </button>
        <p className="text-[11px] text-text-dim mt-3 text-center">Public SEC data · research demo · not investment advice.</p>
      </div>
    </div>
  )
}
