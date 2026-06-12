import type { FirmBrief, ScoredFirm } from '../types.js'

const fmtMoney = (n: number | null) =>
  n === null ? 'not reported' : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Assemble the grounded context block — the ONLY material the model sees.
 * Persisted to data/brief-contexts.json so the validate stage can confirm
 * every $-figure in a brief traces back here.
 */
export function buildFirmContext(s: ScoredFirm, rank: number, screened: number): string {
  const f = s.firm
  const e = s.enrichment
  const lines: string[] = [
    `Firm: ${f.name}`,
    `Location: ${[f.city, f.state].filter(Boolean).join(', ')}`,
    `CRD: ${f.crd} · Latest ADV filing: ${f.filingDate ?? 'unknown'}`,
    `Rank: #${rank} of ${screened.toLocaleString()} SEC-registered advisers screened · composite score ${s.total.toFixed(0)}/100`,
    '',
    'FORM ADV PART 1 (self-reported regulatory data):',
    `- Total regulatory AUM: ${fmtMoney(f.raumTotal)}`,
    `- Discretionary AUM: ${fmtMoney(f.raumDiscretionary)}${
      f.raumDiscretionary !== null && f.raumTotal ? ` (${Math.round((f.raumDiscretionary / f.raumTotal) * 100)}% of total)` : ''
    }`,
    `- HNW-individual AUM: ${fmtMoney(f.raumHnw)}${
      f.raumHnw !== null && f.raumTotal ? ` (${Math.round((f.raumHnw / f.raumTotal) * 100)}% of total)` : ''
    }`,
    `- HNW individual clients: ${f.clientsHnw ?? 'not reported'} · other individual clients: ${f.clientsIndividual ?? 'not reported'}`,
    `- Employees: ${f.employees ?? 'not reported'}`,
    `- Advises private funds (Item 7.B): ${f.advisesPrivateFunds === null ? 'not reported' : f.advisesPrivateFunds ? 'Yes' : 'No'}`,
  ]
  if (f.privateFundCount) {
    const types: string[] = []
    if (f.peFundCount) types.push(`${f.peFundCount} private equity`)
    if (f.hedgeFundCount) types.push(`${f.hedgeFundCount} hedge`)
    if (f.realEstateFundCount) types.push(`${f.realEstateFundCount} real estate`)
    lines.push(
      `- Private funds advised: ${f.privateFundCount}${types.length ? ` (${types.join(', ')})` : ''} · gross assets ${fmtMoney(
        f.privateFundGrossAssets,
      )}`,
    )
  }

  lines.push('', 'SCORE COMPONENTS (deterministic, computed from the data above):')
  for (const c of s.components) {
    lines.push(`- ${c.label}: ${c.status === 'missing' ? 'no data' : `${Math.round((c.score ?? 0) * 100)}/100`} — ${c.evidence}`)
  }

  if (e) {
    lines.push('', 'ENRICHMENT (ADV PDF + firm homepage):')
    if (e.custodians.length) {
      for (const c of e.custodians) {
        lines.push(`- Custodian: ${c.name}${c.platformNote ? ` — ${c.platformNote}` : ''}`)
      }
    } else {
      lines.push('- Custodians: none extracted')
    }
    if (e.structureHits.length) lines.push(`- Website mentions vehicle structures: ${e.structureHits.join(', ')}`)
    if (e.competitorHits.length)
      lines.push(`- Website mentions competing alts managers (existing shelf relationships): ${e.competitorHits.join(', ')}`)
    if (e.websiteFetchedAt) lines.push(`- Homepage fetched: ${e.websiteFetchedAt}`)
  }

  return lines.join('\n')
}

/** Data-only fallback when Claude is unavailable — every field straight from the firm record. */
export function skeletonBrief(s: ScoredFirm): FirmBrief {
  const grounded = s.components.filter(c => c.status === 'scored').map(c => `${c.label}: ${c.evidence}`)
  return {
    positioning_summary: `${s.firm.name} (${[s.firm.city, s.firm.state].filter(Boolean).join(', ')}) — composite alts-readiness score ${s.total.toFixed(0)}/100.`,
    alts_readiness_bullets: grounded.slice(0, 4),
    current_alts_footprint:
      s.firm.advisesPrivateFunds && s.firm.privateFundCount
        ? `Advises ${s.firm.privateFundCount} private fund(s) per Form ADV Item 7.B.`
        : 'No private funds disclosed in Form ADV Item 7.B.',
    suggested_kkr_angle: 'Generated without LLM (no API key) — see score components above for the data-driven angle.',
    conversation_starters: [
      'How are you currently sourcing and diligencing private-market allocations?',
      'What role do semi-liquid or evergreen structures play in your client portfolios today?',
      'What operational hurdles have kept alternatives allocations below target, if any?',
    ],
    caveats: ['Skeleton brief rendered from ADV data only; run stage 4 with an ANTHROPIC_API_KEY for the full narrative.'],
  }
}

export function renderBriefHtml(
  s: ScoredFirm,
  brief: FirmBrief,
  meta: { rank: number; screened: number; snapshot: string },
): string {
  const f = s.firm
  const e = s.enrichment
  const tile = (label: string, value: string) =>
    `<div class="tile"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`

  const tiles = [
    tile('Total RAUM', fmtMoney(f.raumTotal)),
    tile('Discretionary', f.raumDiscretionary !== null && f.raumTotal ? `${Math.round((f.raumDiscretionary / f.raumTotal) * 100)}%` : '—'),
    tile('HNW share', f.raumHnw !== null && f.raumTotal ? `${Math.round((f.raumHnw / f.raumTotal) * 100)}%` : '—'),
    tile('Employees', f.employees?.toString() ?? '—'),
    tile('Custodian', e?.custodians[0]?.name ?? '—'),
    tile('ADV filed', f.filingDate ?? '—'),
  ].join('')

  const list = (items: string[]) => items.map(i => `<li>${esc(i)}</li>`).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(f.name)} — pre-meeting brief</title>
<style>
  :root{--ink:#15202b;--mut:#5b6b7b;--accent:#11385e;--line:#e3e8ee}
  *{box-sizing:border-box}body{font:13.5px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:var(--ink);max-width:760px;margin:0 auto;padding:28px}
  header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid var(--accent);padding-bottom:10px}
  h1{font-size:21px;margin:0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin:20px 0 6px}
  .rank{background:var(--accent);color:#fff;border-radius:14px;padding:3px 12px;font-weight:700;font-size:13px;white-space:nowrap}
  .sub{color:var(--mut);font-size:12.5px;margin-top:4px}
  .sub a{color:var(--accent)}
  .tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:14px}
  .tile{border:1px solid var(--line);border-radius:6px;padding:8px;text-align:center}
  .tile .v{font-weight:700;font-size:14.5px}.tile .l{font-size:10.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
  ul{margin:4px 0;padding-left:20px}li{margin:3px 0}
  p{margin:4px 0}
  footer{margin-top:22px;border-top:1px solid var(--line);padding-top:8px;font-size:11px;color:var(--mut)}
  @media print{body{padding:0;font-size:12px}.tiles{gap:6px}h2{margin:14px 0 4px}@page{margin:1.4cm}}
</style></head><body>
<header>
  <div><h1>${esc(f.name)}</h1>
  <div class="sub">${esc([f.city, f.state].filter(Boolean).join(', '))} · <a href="https://adviserinfo.sec.gov/firm/summary/${f.crd}">CRD ${f.crd}</a>${
    f.website ? ` · <a href="${esc(/^https?:/i.test(f.website) ? f.website : `https://${f.website}`)}">${esc(f.website.replace(/^https?:\/\//i, '').toLowerCase())}</a>` : ''
  }</div></div>
  <div class="rank">#${meta.rank} of ${meta.screened.toLocaleString()} · score ${s.total.toFixed(0)}</div>
</header>
<div class="tiles">${tiles}</div>
<h2>Positioning</h2><p>${esc(brief.positioning_summary)}</p>
<h2>Why they're alts-ready</h2><ul>${list(brief.alts_readiness_bullets)}</ul>
<h2>Current alternatives footprint</h2><p>${esc(brief.current_alts_footprint)}</p>
<h2>Suggested angle</h2><p>${esc(brief.suggested_kkr_angle)}</p>
<h2>Conversation starters</h2><ul>${list(brief.conversation_starters)}</ul>
<footer>
  Sources: SEC Form ADV public roster (snapshot ${esc(meta.snapshot)}, filing dated ${esc(f.filingDate ?? 'n/a')})${
    e?.websiteFetchedAt ? `; firm homepage fetched ${esc(e.websiteFetchedAt)}` : ''
  }. AUM figures are self-reported regulatory AUM. Scores are deterministic — the LLM writes prose, never numbers.
  Caveats: ${esc(brief.caveats.join(' · '))}. Research demo — not investment advice.
</footer>
</body></html>`
}
