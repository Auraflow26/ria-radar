import Link from 'next/link'

export const metadata = { title: 'Methodology — RIA Radar' }

const SIGNALS = [
  ['Existing private-fund / alts exposure', '28', 'Form ADV Item 7.B + fund-type counts', 'Firms already running private vehicles have done the operational and diligence work — shortest path to a first allocation.'],
  ['High-net-worth client mix', '30', 'Item 5.D HNW RAUM ÷ total RAUM', 'Evergreen and semi-liquid products need qualified HNW books; mass-affluent-only firms cannot allocate.'],
  ['AUM scale', '25', 'Item 5.F total regulatory AUM', 'Distribution scales with shelf space — a $20B aggregator moves more than a hundred small firms.'],
  ['Custodian platform access', '9', 'Schedule D 5.K(3) custodian names (live ADV PDF)', 'Custody at the major platforms means the operational rails for alt distribution already exist.'],
  ['Discretionary ratio', '4', 'Item 5.F discretionary ÷ total', 'A discretionary book means a model allocation can be implemented across households at once.'],
  ['Website alts language', '2', 'Firm homepage scan (JS-rendered when needed)', 'They already market private-markets capability — a warm conversation, not an education call.'],
  ['AUM growth', '2', 'Total RAUM, current vs prior monthly snapshot', 'Growing firms are adding advisors and products; growth correlates with openness to new shelf.'],
  ['Coverage feedback', '5', 'Logged call outcomes', 'Closes the loop — real outcomes nudge the rank. Neutral until data exists.'],
]

export default function MethodPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="text-xs text-text-muted hover:text-accent-light font-mono">← ranked list</Link>
      <h2 className="text-2xl font-bold text-text-primary mt-3">How this list is built</h2>
      <p className="text-sm text-text-secondary mt-2">
        Every US wealth-channel RIA in the SEC&apos;s Form ADV roster, scored on alts-readiness from public filings.
        The question isn&apos;t <em>who are the RIAs</em> — that list is for sale. It&apos;s <strong>who to call first, and what to say when they pick up.</strong>
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">The funnel</h3>
      <p className="text-sm text-text-secondary">
        16,876 filings → ~2,100 in-scope wealth-channel firms → all scored → top 75 enriched with the live ADV PDF
        (custodians, Schedule D 7.B fund detail) and a homepage scan → top firms get a grounded brief.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">The score — eight signals</h3>
      <p className="text-sm text-text-muted mb-3">
        Deterministic. Weights renormalize over whatever data a firm actually reports, so a missing data point lowers
        confidence — it never invents a penalty. Weights below are the balanced house view; desk lenses re-weight them live.
      </p>
      <div className="space-y-2">
        {SIGNALS.map(([label, w, src, why]) => (
          <div key={label} className="bg-bg-card border border-[rgba(139,92,246,0.12)] rounded-input p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-text-primary">{label}</span>
              <span className="font-mono text-xs text-accent-bright">w {w}</span>
            </div>
            <p className="text-xs text-text-muted mt-1">{why}</p>
            <p className="text-[11px] text-text-dim mt-1 font-mono">{src}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">Desk lenses</h3>
      <p className="text-sm text-text-secondary">
        A credit desk and a PE desk should not call the same firms first. The list re-ranks instantly by desk thesis —
        credit leans alts machinery + custody; PE leans HNW + scale; real estate leans income HNW + discretionary.
        Same universe, your priorities.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">Why you can trust the briefs</h3>
      <p className="text-sm text-text-secondary">
        The numbers are computed deterministically; the model only writes prose around them — it never produces a figure.
        A <strong>grounding gate</strong> then checks every dollar amount and percentage in every brief against the firm&apos;s
        own filing data and <strong>rejects the brief if anything doesn&apos;t trace back</strong>. This isn&apos;t aspirational:
        the gate has caught a real hallucination in testing and blocked it. AI you can put in front of a client.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mt-7 mb-2">Honest limits</h3>
      <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
        <li>Public SEC data only. Self-reported regulatory AUM; some firms amend annually, so figures can lag a filing cycle.</li>
        <li>Structured bulk data (when used) ends 2024-12 and is labeled as such; live ADV PDFs are current.</li>
        <li>This is a research demo, not investment advice.</li>
      </ul>

      <p className="mt-8 text-[11px] text-text-dim border-t border-[rgba(139,92,246,0.08)] pt-3">
        Built as a working answer to a distribution problem — not a product pitch. Public SEC data · research demo.
      </p>
    </div>
  )
}
