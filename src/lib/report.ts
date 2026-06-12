import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { SIGNALS } from '../../config/scoring.js'
import type { ExcludedFirm, ScoredFirm } from '../types.js'

const OUT_DIR = 'output'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const csvCell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const fmtB = (n: number | null) => (n === null ? '' : (n / 1e9).toFixed(2))

export function writeRankedCsv(ranked: ScoredFirm[], excluded: ExcludedFirm[]): void {
  mkdirSync(OUT_DIR, { recursive: true })

  const componentCols = SIGNALS.flatMap(s => [`${s.key}_score`, `${s.key}_evidence`])
  const header = [
    'rank', 'score', 'data_completeness', 'crd', 'firm', 'city', 'state', 'website',
    'raum_total_$B', 'raum_discretionary_$B', 'hnw_raum_$B', 'employees',
    'private_funds', 'pe_funds', 'filing_date',
    ...componentCols,
  ]

  const rows = ranked.map((r, i) => {
    const f = r.firm
    const base = [
      i + 1, r.total, r.dataCompleteness, f.crd, f.name, f.city ?? '', f.state ?? '', f.website ?? '',
      fmtB(f.raumTotal), fmtB(f.raumDiscretionary), fmtB(f.raumHnw), f.employees ?? '',
      f.privateFundCount ?? '', f.peFundCount ?? '', f.filingDate ?? '',
    ]
    const comps = SIGNALS.flatMap(s => {
      const c = r.components.find(c => c.key === s.key)
      return [c?.score === null || c?.score === undefined ? '' : Math.round(c.score * 100), c?.evidence ?? '']
    })
    return [...base, ...comps].map(csvCell).join(',')
  })

  writeFileSync(join(OUT_DIR, 'ranked-rias.csv'), [header.join(','), ...rows].join('\n'))
  writeFileSync(
    join(OUT_DIR, 'excluded.csv'),
    ['crd,name,reason', ...excluded.map(e => [e.crd, e.name, e.reason].map(csvCell).join(','))].join('\n'),
  )
}

export function writeRankedHtml(ranked: ScoredFirm[], meta: { screened: number; snapshot: string }): void {
  mkdirSync(OUT_DIR, { recursive: true })

  const rows = ranked
    .map((r, i) => {
      const f = r.firm
      const bars = r.components
        .map(c => {
          const pct = c.score === null ? 0 : Math.round(c.score * 100)
          const fill = c.status === 'missing' ? 'miss' : pct >= 70 ? 'hi' : pct >= 40 ? 'mid' : 'lo'
          return `<div class="comp">
            <div class="comp-head"><span>${esc(c.label)}</span><span class="w">${
              c.status === 'missing' ? 'no data' : `${pct} · weight ${c.weight}`
            }</span></div>
            <div class="bar"><div class="fill ${fill}" style="width:${pct}%"></div></div>
            <div class="ev">${esc(c.evidence)}</div>
          </div>`
        })
        .join('')
      const site = f.website
        ? `<a href="${esc(/^https?:/i.test(f.website) ? f.website : `https://${f.website}`)}" target="_blank">site</a>`
        : ''
      return `<tr class="main" onclick="this.nextElementSibling.classList.toggle('open')">
        <td class="rank">${i + 1}</td>
        <td class="name">${esc(f.name)}<span class="loc">${esc([f.city, f.state].filter(Boolean).join(', '))}</span></td>
        <td class="num">${f.raumTotal === null ? '—' : `$${(f.raumTotal / 1e9).toFixed(1)}B`}</td>
        <td class="num">${f.raumHnw !== null && f.raumTotal ? Math.round((f.raumHnw / f.raumTotal) * 100) + '%' : '—'}</td>
        <td class="num">${f.privateFundCount || '—'}</td>
        <td class="score"><span class="badge">${r.total.toFixed(0)}</span></td>
        <td class="links"><a href="https://adviserinfo.sec.gov/firm/summary/${f.crd}" target="_blank">ADV</a> ${site}</td>
      </tr>
      <tr class="detail"><td colspan="7"><div class="comps">${bars}</div>
        <div class="meta">CRD ${f.crd} · last ADV filing ${esc(f.filingDate ?? 'n/a')} · data completeness ${Math.round(
          r.dataCompleteness * 100,
        )}%</div></td></tr>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>RIA Radar — ranked alts-ready RIAs</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--ink:#15202b;--mut:#5b6b7b;--line:#e3e8ee;--hi:#1a7f4b;--mid:#b07d1a;--lo:#9aa7b4;--accent:#11385e}
  *{box-sizing:border-box}body{font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:var(--ink);margin:0;background:#f7f9fb}
  header{background:var(--accent);color:#fff;padding:22px 28px}
  header h1{margin:0;font-size:20px}header p{margin:6px 0 0;opacity:.85;font-size:13px}
  table{width:100%;border-collapse:collapse;background:#fff}
  th{position:sticky;top:0;background:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);padding:10px 12px;border-bottom:2px solid var(--line)}
  td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
  tr.main{cursor:pointer}tr.main:hover{background:#f0f4f8}
  .rank{color:var(--mut);width:36px}.name{font-weight:600}.loc{display:block;font-weight:400;font-size:12px;color:var(--mut)}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .badge{display:inline-block;background:var(--accent);color:#fff;border-radius:14px;padding:3px 11px;font-weight:700}
  .links a{color:var(--accent);font-size:12px;margin-right:6px}
  tr.detail{display:none}tr.detail.open{display:table-row;background:#fbfcfe}
  .comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;padding:6px 2px}
  .comp-head{display:flex;justify-content:space-between;font-size:12px;font-weight:600}.comp-head .w{color:var(--mut);font-weight:400}
  .bar{height:7px;background:#edf1f5;border-radius:4px;margin:4px 0}
  .fill{height:100%;border-radius:4px}.fill.hi{background:var(--hi)}.fill.mid{background:var(--mid)}.fill.lo{background:var(--lo)}.fill.miss{background:transparent}
  .ev{font-size:12px;color:var(--mut)}
  .meta{font-size:12px;color:var(--mut);padding:8px 2px 2px}
  footer{padding:18px 28px;font-size:12px;color:var(--mut)}
</style></head><body>
<header><h1>RIA Radar — alts-ready RIA targeting</h1>
<p>${ranked.length} ranked of ${meta.screened.toLocaleString()} SEC-registered advisers screened · Form ADV snapshot ${esc(
    meta.snapshot,
  )} · click any row for the score breakdown · scores are deterministic — the LLM writes prose, never numbers</p></header>
<table><thead><tr><th></th><th>Firm</th><th style="text-align:right">RAUM</th><th style="text-align:right">HNW&nbsp;%</th><th style="text-align:right">Private funds</th><th>Score</th><th></th></tr></thead>
<tbody>${rows}</tbody></table>
<footer>Source: SEC Form ADV public monthly roster (adviserinfo.sec.gov). Regulatory AUM is self-reported. Research demo — not investment advice.</footer>
</body></html>`

  writeFileSync(join(OUT_DIR, 'ranked-rias.html'), html)
}
