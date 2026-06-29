'use client'

import { useState } from 'react'

interface Turn { q: string; a: string }

const SUGGESTIONS = [
  'How does the score work?',
  'What do the desk lenses do?',
  'Which firms have the most private funds?',
  'How should I use this tool?',
]

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function ask(question: string) {
    if (!question.trim() || busy) return
    setBusy(true); setErr(''); setQ('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) setErr(data.error ?? 'Unavailable.')
      else setTurns(t => [...t, { q: question, a: data.answer }])
    } catch { setErr('Network error.') }
    setBusy(false)
  }

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 bg-accent text-white rounded-pill px-4 py-3 text-sm font-medium shadow-lg hover:bg-accent-light transition-colors"
        aria-label="Open KKR Research Guide"
      >
        {open ? '✕ Close' : '💬 KKR Research Guide'}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[min(92vw,380px)] max-h-[70vh] flex flex-col bg-bg-elevated border border-[rgba(0,163,224,0.3)] rounded-card shadow-2xl">
          <div className="px-4 py-3 border-b border-[rgba(0,163,224,0.15)]">
            <p className="text-sm font-semibold text-text-primary">KKR Research Guide</p>
            <p className="text-[11px] text-text-muted">Ask about the data or how the tool works — answers grounded in the dataset.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    className="text-[11px] text-text-secondary border border-[rgba(0,163,224,0.2)] rounded-pill px-2.5 py-1 hover:bg-bg-card transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i}>
                <p className="text-xs text-accent-light font-medium">{t.q}</p>
                <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{t.a}</p>
              </div>
            ))}
            {busy && <p className="text-xs text-text-muted">Thinking…</p>}
            {err && <p className="text-xs text-danger">{err}</p>}
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(q) }} className="flex gap-2 p-3 border-t border-[rgba(0,163,224,0.15)]">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Ask anything…"
              maxLength={500}
              className="flex-1 bg-bg-secondary border border-[rgba(0,163,224,0.2)] rounded-input px-3 py-2 text-xs text-text-primary placeholder:text-text-dim outline-none focus:border-[rgba(0,163,224,0.5)]"
            />
            <button type="submit" disabled={busy || !q.trim()}
              className="bg-accent text-white rounded-input px-3 py-2 text-xs font-medium disabled:opacity-50">
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  )
}
