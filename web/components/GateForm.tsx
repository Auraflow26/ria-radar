'use client'

import { useState } from 'react'

export function GateForm({ next }: { next: string }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const res = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    setBusy(false)
    if (res.ok) {
      window.location.href = next || '/'
    } else {
      setErr('Incorrect password.')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        placeholder="Access password"
        autoFocus
        className="w-full bg-bg-secondary border border-[rgba(0,163,224,0.2)] rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-[rgba(0,163,224,0.5)] outline-none"
      />
      <button
        type="submit"
        disabled={busy || !pw}
        className="w-full bg-accent text-white rounded-input px-3 py-2 text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Enter'}
      </button>
      {err && <p className="text-danger text-xs">{err}</p>}
    </form>
  )
}
