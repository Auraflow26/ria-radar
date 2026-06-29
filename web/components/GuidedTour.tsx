'use client'

import { useEffect, useState, useCallback } from 'react'

const KEY = 'ria_tour_v2'

interface Stop {
  anchor: string | null // data-tour value, or null for a centered card
  title: string
  body: string
  href?: string // optional "take me there" link
  hrefLabel?: string
}

const STOPS: Stop[] = [
  {
    anchor: 'score',
    title: 'The score',
    body: "This number (0–100) is alts-readiness — deterministic arithmetic from SEC filings, not an AI opinion. Click any score to see exactly how it was built.",
  },
  {
    anchor: 'lenses',
    title: 'Desk lenses',
    body: "Hit a different desk — Private credit, PE, Real estate — and watch 200+ firms re-rank. Same universe, your product's priorities. ⚙ Custom gives you the sliders.",
  },
  {
    anchor: 'queue',
    title: 'Work the queue',
    body: "★ = priority this week · ✓ = called · ⊘ = skip. Toggle 'Hide called' to clean your view. It's a call queue, not a leaderboard.",
  },
  {
    anchor: 'filters',
    title: 'Filter to your territory',
    body: "Filter first. NY + ≥$10B narrows to your regional swing list before you do anything else.",
  },
  {
    anchor: null,
    title: 'Every brief is grounded',
    body: "Click any firm for its pre-meeting brief. Every number traces to that firm's own SEC filing — the 'grounded' badge means it passed a hallucination check.",
  },
  {
    anchor: null,
    title: 'Ask in plain English',
    body: "Skip the analyst. Ask the data directly — try \"Which Schwab firms have more than 5 private funds in Texas?\"",
    href: '/ask',
    hrefLabel: 'Open Ask the data',
  },
  {
    anchor: 'guide',
    title: 'The Research Guide',
    body: "Stuck? Ask this, bottom-right. It knows the dataset and the methodology cold — answers data questions and explains how anything works.",
  },
]

interface Rect { top: number; left: number; width: number; height: number }

export function GuidedTour() {
  const [active, setActive] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setActive(true)
  }, [])

  const measure = useCallback(() => {
    const stop = STOPS[i]
    if (!stop?.anchor) { setRect(null); return }
    const el = document.querySelector<HTMLElement>(`[data-tour="${stop.anchor}"]`)
    if (!el) { setRect(null); return }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [i])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(measure, 120) // let scroll settle
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, i, measure])

  if (!active) return null

  function close() {
    localStorage.setItem(KEY, '1')
    setActive(false)
  }
  const stop = STOPS[i]
  const last = i === STOPS.length - 1

  // tooltip position: below the anchor if room, else centered
  const pad = 12
  const tipStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(rect.top + rect.height + pad, window.innerHeight - 220),
        left: Math.min(Math.max(rect.left, 12), window.innerWidth - 332),
        width: 320,
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(92vw,360px)' }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* dim backdrop; click skips */}
      <div className="absolute inset-0 bg-black/60" onClick={close} />

      {/* highlight ring around the anchored element */}
      {rect && (
        <div
          className="absolute rounded-lg border-2 border-accent pointer-events-none transition-all"
          style={{
            top: rect.top - 4, left: rect.left - 4,
            width: rect.width + 8, height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      )}

      {/* tooltip card */}
      <div style={tipStyle} className="bg-bg-elevated border border-[rgba(0,163,224,0.4)] rounded-card p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-text-dim">{i + 1} / {STOPS.length}</span>
          <button type="button" onClick={close} className="text-[11px] text-text-muted hover:text-text-secondary">Skip tour</button>
        </div>
        <h3 className="text-sm font-semibold text-text-primary">{stop.title}</h3>
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{stop.body}</p>
        {stop.href && (
          <a href={stop.href} className="inline-block mt-2 text-xs text-accent hover:text-accent-bright">{stop.hrefLabel} →</a>
        )}
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            disabled={i === 0}
            onClick={() => setI(n => Math.max(0, n - 1))}
            className="text-xs text-text-muted disabled:opacity-30 hover:text-text-secondary"
          >
            ← Back
          </button>
          <div className="flex gap-1">
            {STOPS.map((_, n) => (
              <span key={n} className={`w-1.5 h-1.5 rounded-full ${n === i ? 'bg-accent' : 'bg-text-dim'}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (last ? close() : setI(n => n + 1))}
            className="bg-accent text-white rounded-input px-3 py-1.5 text-xs font-medium hover:bg-accent-light"
          >
            {last ? 'Done' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
