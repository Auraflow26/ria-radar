'use client'

import { useState } from 'react'

interface Turn { q: string; a: string }

export function AskChat({ suggestions }: { suggestions: string[] }) {
  const [q, setQ] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function ask(question: string) {
    if (!question.trim() || busy) return
    setBusy(true)
    setErr('')
    setQ('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error ?? 'Something went wrong.')
      } else {
        setTurns(t => [...t, { q: question, a: data.answer }])
      }
    } catch {
      setErr('Network error.')
    }
    setBusy(false)
  }

  return (
    <div>
      <form
        onSubmit={e => { e.preventDefault(); ask(q) }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ask about the firm list…"
          maxLength={500}
          className="flex-1 bg-bg-card border border-[rgba(139,92,246,0.2)] rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-[rgba(139,92,246,0.5)] outline-none"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="bg-accent text-white rounded-input px-4 py-2 text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {busy ? '…' : 'Ask'}
        </button>
      </form>

      {turns.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-xs text-text-secondary border border-[rgba(139,92,246,0.2)] rounded-pill px-3 py-1.5 hover:bg-bg-elevated transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {err && <p className="text-danger text-xs mt-3 font-mono">{err}</p>}

      <div className="mt-6 space-y-5">
        {turns.map((t, i) => (
          <div key={i}>
            <p className="text-sm text-accent-light font-medium">{t.q}</p>
            <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{t.a}</p>
          </div>
        ))}
        {busy && <p className="text-sm text-text-muted">Thinking…</p>}
      </div>

      <p className="mt-8 text-[11px] text-text-dim border-t border-[rgba(139,92,246,0.08)] pt-3">
        Answers are grounded in the 150-firm dataset only · public SEC data · research demo · not investment advice.
      </p>
    </div>
  )
}
