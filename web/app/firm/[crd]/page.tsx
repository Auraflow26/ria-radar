import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase, type Firm, type Brief, fmtMoney } from '@/lib/supabase'
import { OutcomeLogger } from '@/components/OutcomeLogger'
import { SourceContext } from '@/components/SourceContext'
import { PrintButton } from '@/components/PrintButton'

export const revalidate = 300

export default async function FirmPage({ params }: { params: Promise<{ crd: string }> }) {
  const { crd } = await params
  const crdNum = Number(crd)

  const [{ data: firm }, { data: brief }] = await Promise.all([
    supabase.from('kkr_ria_firms').select('*').eq('crd', crdNum).single(),
    supabase.from('kkr_ria_briefs').select('*').eq('crd', crdNum).maybeSingle(),
  ])

  if (!firm) notFound()
  const f = firm as Firm
  const b = brief as Brief | null

  const pct = (n: number | null) =>
    n !== null && f.raum_total ? `${Math.round((n / f.raum_total) * 100)}%` : '—'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs text-text-muted hover:text-accent font-mono no-print">← call queue</Link>
        <PrintButton />
      </div>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{f.name}</h2>
          <p className="text-sm text-text-muted mt-1">
            {[f.city, f.state].filter(Boolean).join(', ')} ·{' '}
            <a className="text-accent-light" href={`https://adviserinfo.sec.gov/firm/summary/${f.crd}`} target="_blank" rel="noreferrer">
              CRD {f.crd}
            </a>
            {f.website && (
              <>
                {' · '}
                <a className="text-accent-light" href={/^https?:/i.test(f.website) ? f.website : `https://${f.website}`} target="_blank" rel="noreferrer">
                  {f.website.replace(/^https?:\/\//i, '')}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="bg-accent text-white rounded-pill px-4 py-1.5 font-mono font-bold whitespace-nowrap">
          #{f.rank} · {Math.round(f.score)}
        </div>
      </div>

      {/* tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        {[
          ['Total RAUM', fmtMoney(f.raum_total)],
          ['Discretionary', pct(f.raum_discretionary)],
          ['HNW share', pct(f.raum_hnw)],
          ['Private funds', String(f.private_fund_count ?? '—')],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-card p-3 text-center">
            <div className="font-mono font-semibold text-text-primary">{v}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* brief */}
      {b ? (
        <section className="mt-7">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs uppercase tracking-wide text-gold font-semibold">Pre-meeting brief</h3>
            <span className="font-mono text-[10px] text-text-dim">{b.model}</span>
            {b.grounded && <span className="font-mono text-[10px] text-success">✓ grounded</span>}
          </div>
          <p className="text-sm text-text-secondary">{b.brief.positioning_summary}</p>

          <h4 className="text-xs uppercase tracking-wide text-text-muted mt-4 mb-1">Why they&apos;re alts-ready</h4>
          <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
            {b.brief.alts_readiness_bullets.map((x, i) => <li key={i}>{x}</li>)}
          </ul>

          <h4 className="text-xs uppercase tracking-wide text-text-muted mt-4 mb-1">Current footprint</h4>
          <p className="text-sm text-text-secondary">{b.brief.current_alts_footprint}</p>

          <h4 className="text-xs uppercase tracking-wide text-text-muted mt-4 mb-1">Suggested angle</h4>
          <p className="text-sm text-text-secondary">{b.brief.suggested_angle}</p>

          <h4 className="text-xs uppercase tracking-wide text-text-muted mt-4 mb-1">Conversation starters</h4>
          <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
            {b.brief.conversation_starters.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
          <SourceContext context={b.source_context} />
        </section>
      ) : (
        <p className="mt-7 text-sm text-text-muted">No brief generated for this firm (outside top-N).</p>
      )}

      {/* score breakdown */}
      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-wide text-accent font-semibold mb-2">Why this rank — score components</h3>
        <div className="space-y-2">
          {f.components.map(c => {
            const val = c.status === 'missing' ? null : Math.round((c.score ?? 0) * 100)
            const tone = val === null ? 'bg-text-dim' : val >= 70 ? 'bg-accent' : val >= 40 ? 'bg-accent-light' : 'bg-[rgba(0,163,224,0.35)]'
            return (
              <div key={c.key} className="bg-bg-card border border-[rgba(0,163,224,0.12)] rounded-input p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{c.label}</span>
                  <span className="font-mono text-xs text-text-secondary">{val === null ? 'no data' : `${val}/100`}</span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-pill mt-2 overflow-hidden">
                  <div className={`h-full ${tone}`} style={{ width: `${val ?? 0}%` }} />
                </div>
                <p className="text-xs text-text-muted mt-1.5">{c.evidence}</p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="no-print">
        <OutcomeLogger crd={f.crd} />
      </div>

      {/* print-only meeting notes section */}
      <div className="print-only mt-6">
        <h3 className="text-xs uppercase tracking-wide font-semibold">My notes</h3>
        <div className="print-notes" />
      </div>

      {b && (
        <p className="mt-8 text-[11px] text-text-dim border-t border-[rgba(0,163,224,0.08)] pt-3">
          Caveats: {b.brief.caveats.join(' · ')}. Scores are deterministic; the LLM writes prose, never numbers. Public SEC data — research demo, not investment advice.
        </p>
      )}
    </div>
  )
}
