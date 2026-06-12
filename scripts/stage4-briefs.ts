import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { BRIEF_TOP_N_DEFAULT } from '../config/scoring.js'
import { generateBrief, hasApiKey } from '../src/lib/claude.js'
import { buildFirmContext, renderBriefHtml, skeletonBrief } from '../src/lib/brief.js'
import type { ScoredFirm } from '../src/types.js'

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export async function runBriefs(topN = BRIEF_TOP_N_DEFAULT): Promise<void> {
  console.log(`stage 4 — briefs (top ${topN})`)
  if (!hasApiKey()) {
    console.warn('  ⚠ no ANTHROPIC_API_KEY — rendering data-only skeleton briefs (still grounded, no narrative)')
  }

  const scored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json', 'utf8'))
  const meta = JSON.parse(readFileSync('data/ingest-meta.json', 'utf8'))
  const targets = scored.slice(0, topN)

  mkdirSync('output/briefs', { recursive: true })
  const contexts: Record<string, string> = {}
  const indexRows: string[] = []

  for (const [i, s] of targets.entries()) {
    const rank = i + 1
    const context = buildFirmContext(s, rank, meta.rosterTotal)
    contexts[s.firm.crd] = context

    const brief = (hasApiKey() ? await generateBrief(context) : null) ?? skeletonBrief(s)
    const html = renderBriefHtml(s, brief, { rank, screened: meta.rosterTotal, snapshot: meta.snapshot })
    const file = `${String(rank).padStart(2, '0')}-${s.firm.crd}-${slug(s.firm.name)}.html`
    writeFileSync(join('output/briefs', file), html)
    indexRows.push(
      `<li><a href="${file}">#${rank} — ${s.firm.name}</a> <span>score ${s.total.toFixed(0)} · ${[s.firm.city, s.firm.state]
        .filter(Boolean)
        .join(', ')}</span></li>`,
    )
    console.log(`  ✓ [${rank}/${targets.length}] ${s.firm.name}`)
  }

  writeFileSync('data/brief-contexts.json', JSON.stringify(contexts))
  writeFileSync(
    'output/briefs/index.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RIA Radar — briefs</title>
<style>body{font:15px/1.6 -apple-system,sans-serif;max-width:640px;margin:40px auto;color:#15202b}
h1{font-size:20px}li{margin:6px 0}a{color:#11385e;font-weight:600}span{color:#5b6b7b;font-size:13px}</style>
</head><body><h1>Pre-meeting briefs — top ${targets.length}</h1><ol>${indexRows.join('')}</ol></body></html>`,
  )
  console.log(`  ✓ output/briefs/ (${targets.length} briefs + index)`)
}
