import Link from 'next/link'

export const metadata = { title: "How I'd work this — RIA Radar" }

const STARTERS = [
  ['1', 'Bailard', 'Foster City, CA', '$7.6B', 'Schwab', '1', 'HNW book on a Schwab alts platform; one fund already — room to add'],
  ['2', 'Davenport', 'Richmond, VA', '$24.7B', 'Pershing', '3', 'Scale + three private funds; operational rails proven'],
  ['3', 'Allegheny Financial', 'Pittsburgh, PA', '$5.6B', 'Fidelity', '13', 'Thirteen funds — this firm lives in alts; warm conversation'],
  ['4', 'Tocqueville', 'New York, NY', '$10.2B', 'Pershing', '5', 'Manhattan HNW, five funds, established shelf'],
  ['7', 'Fiduciary Trust Intl', 'Lincoln, MA', '$7.7B', 'Fidelity', '7', 'Trust-company HNW depth + seven funds'],
]

export default function MemoPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="text-xs text-text-muted hover:text-accent-light font-mono">← ranked list</Link>
      <h2 className="text-2xl font-bold text-text-primary mt-3">How I&apos;d work the RIA channel — a first pass</h2>
      <p className="text-xs text-text-dim mt-1 italic">
        A working note, not a pitch. Built from public SEC Form ADV data on the full US wealth-channel adviser universe.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">The problem as I see it</h3>
      <p className="text-sm text-text-secondary">
        You don&apos;t have a <em>data</em> problem — the RIA list is for sale from a dozen vendors. You have a{' '}
        <strong>prioritization and preparation</strong> problem: ~2,100 in-scope advisers, finite wholesalers, and a
        partner asking &quot;who did you call and why.&quot; The work that matters is <strong>who to call first, and what to open with.</strong>
        So I built what I&apos;d want a new analyst to hand me: every firm scored on alts-readiness from its own filing,
        re-rankable by desk, with a one-page brief where every number traces to the source.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">How I read &quot;ready&quot;</h3>
      <p className="text-sm text-text-secondary">
        Eight signals from the ADV. The two that gate everything: <strong>HNW client mix</strong> (evergreen product
        needs qualified buyers) and <strong>existing private-fund machinery</strong> (they&apos;ve done the operational
        lift — shortest path to a first ticket). Then scale, custody, discretion, growth, and site language. It&apos;s{' '}
        <strong>deterministic</strong> — arithmetic I can defend line-by-line, not a model&apos;s opinion. The AI only
        writes prose, and a gate rejects any brief whose figures don&apos;t trace to the filing.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">Where I&apos;d start this week</h3>
      <div className="overflow-x-auto rounded-card border border-[rgba(0,163,224,0.12)] mt-2">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono">#</th><th className="px-3 py-2">Firm</th>
              <th className="px-3 py-2 font-mono text-right">RAUM</th><th className="px-3 py-2">Custodian</th>
              <th className="px-3 py-2 font-mono text-right">PFs</th><th className="px-3 py-2">Why first</th>
            </tr>
          </thead>
          <tbody>
            {STARTERS.map(([r, n, loc, aum, cust, pf, why]) => (
              <tr key={r} className="border-t border-[rgba(0,163,224,0.08)]">
                <td className="px-3 py-2 font-mono text-text-dim">{r}</td>
                <td className="px-3 py-2"><span className="text-text-primary font-medium">{n}</span><br /><span className="text-[11px] text-text-muted">{loc}</span></td>
                <td className="px-3 py-2 font-mono text-text-secondary text-right">{aum}</td>
                <td className="px-3 py-2 text-text-muted">{cust}</td>
                <td className="px-3 py-2 font-mono text-text-secondary text-right">{pf}</td>
                <td className="px-3 py-2 text-text-muted text-xs">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-dim mt-1">Full 500 ranked in the tool; top 75 carry a grounded brief.</p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">Why this isn&apos;t a vendor list</h3>
      <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1.5">
        <li><strong>Re-ranks by desk.</strong> Flip the lens and the order moves 200+ positions — Allegheny&apos;s 13 funds float a credit desk; a high-HNW no-fund firm floats a PE desk. Same universe, your priorities.</li>
        <li><strong>Numbers can&apos;t lie.</strong> The grounding gate caught a real hallucination in testing and blocked the brief. Client-safe.</li>
        <li><strong>It learns from you.</strong> Log an outcome, it nudges the next ranking. A bought list is frozen the day you buy it.</li>
      </ul>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">What I&apos;d do next — with you, not for you</h3>
      <ol className="list-decimal pl-5 text-sm text-text-secondary space-y-1.5">
        <li><strong>Tune &quot;ready&quot; to your book</strong> — your closed allocations re-weight the signals; the model stops being my guess and becomes your edge.</li>
        <li><strong>Map to territories + relationships</strong> — &quot;who to call in your region you haven&apos;t touched,&quot; once I can see your CRM.</li>
        <li><strong>Widen brief depth</strong> — 75 today is a demo; the pipeline runs to the full universe on a cheaper model with the same gate.</li>
      </ol>

      <p className="mt-8 text-sm text-text-secondary">
        That&apos;s the difference between buying rows and bringing judgment. The tool is just how I keep the judgment
        current and honest.
      </p>
      <p className="mt-3 text-sm text-text-primary">— Mo</p>
      <p className="mt-6 text-[11px] text-text-dim border-t border-[rgba(0,163,224,0.08)] pt-3">Public SEC data · research demo · not investment advice.</p>
    </div>
  )
}
