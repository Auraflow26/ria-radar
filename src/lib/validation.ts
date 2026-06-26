import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ScoredFirm } from '../types.js'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface Check {
  name: string
  status: CheckStatus
  detail: string
}

function check(name: string, value: number, passAt: number, warnAt: number, detail: string): Check {
  const status: CheckStatus = value >= passAt ? 'pass' : value >= warnAt ? 'warn' : 'fail'
  return { name, status, detail }
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function runValidation(): Check[] {
  const checks: Check[] = []

  // --- ingest ---
  const firms = loadJson<unknown[]>('data/firms.json')
  const meta = loadJson<{ rosterTotal: number }>('data/ingest-meta.json')
  if (!firms) {
    checks.push({ name: 'ingest: firms.json exists', status: 'fail', detail: 'data/firms.json missing — run stage 1' })
  } else {
    const rosterTotal = meta?.rosterTotal ?? 0
    checks.push(check('ingest: roster row count', rosterTotal, 10_000, 5_000, `${rosterTotal.toLocaleString()} firms in raw roster`))
    checks.push(check('ingest: in-scope firms', firms.length, 2_000, 1_000, `${firms.length.toLocaleString()} firms pass ingest filter`))
    const withRaum = (firms as { raumTotal: number | null }[]).filter(f => f.raumTotal !== null).length
    const pct = (withRaum / firms.length) * 100
    checks.push(check('ingest: RAUM coverage', pct, 95, 85, `${pct.toFixed(1)}% of firms report total RAUM`))
    const withSite = (firms as { website: string | null }[]).filter(f => f.website).length
    const sitePct = (withSite / firms.length) * 100
    checks.push(check('ingest: website coverage', sitePct, 70, 50, `${sitePct.toFixed(1)}% of firms list a website`))
  }

  const prior = loadJson<{ crd: number }[]>('data/firms-prior.json')
  if (firms && prior) {
    const priorSet = new Set(prior.map(f => f.crd))
    const overlap =
      ((firms as { crd: number }[]).filter(f => priorSet.has(f.crd)).length / (firms.length || 1)) * 100
    checks.push(check('ingest: prior-month CRD overlap', overlap, 90, 80, `${overlap.toFixed(1)}% CRD overlap with prior snapshot`))
  }

  // --- score ---
  const scored = loadJson<ScoredFirm[]>('data/scored.json')
  if (!scored) {
    checks.push({ name: 'score: scored.json exists', status: 'fail', detail: 'data/scored.json missing — run stage 2' })
  } else {
    const bad = scored.filter(s => !Number.isFinite(s.total))
    checks.push({
      name: 'score: totals finite',
      status: bad.length === 0 ? 'pass' : 'fail',
      detail: bad.length === 0 ? 'no NaN/Infinity totals' : `${bad.length} non-finite totals`,
    })
    const top50 = scored.slice(0, 50)
    const thin = top50.filter(s => s.components.filter(c => c.status === 'scored').length < 4)
    checks.push({
      name: 'score: top-50 component coverage',
      status: thin.length === 0 ? 'pass' : thin.length <= 5 ? 'warn' : 'fail',
      detail: thin.length === 0 ? 'all top-50 firms scored on ≥4 components' : `${thin.length} top-50 firms scored on <4 components`,
    })
    const totals = scored.map(s => s.total).sort((a, b) => a - b)
    const median = totals[Math.floor(totals.length / 2)] ?? 0
    const max = totals[totals.length - 1] ?? 0
    checks.push({
      name: 'score: distribution sanity',
      status: max <= 100 && median >= 10 && median <= 70 ? 'pass' : 'warn',
      detail: `median ${median.toFixed(1)}, max ${max.toFixed(1)}`,
    })
  }

  // --- enrich ---
  const enriched = loadJson<ScoredFirm[]>('data/enriched.json')
  if (enriched) {
    const withCust = enriched.filter(s => s.enrichment && s.enrichment.custodians.length > 0).length
    const pct = (withCust / (enriched.length || 1)) * 100
    checks.push(check('enrich: custodian extraction rate', pct, 60, 40, `${withCust}/${enriched.length} firms (${pct.toFixed(0)}%) have custodians`))
    const withWeb = enriched.filter(s => s.enrichment?.websiteFetchedAt).length
    const webPct = (withWeb / (enriched.length || 1)) * 100
    checks.push(check('enrich: website fetch rate', webPct, 50, 30, `${withWeb}/${enriched.length} homepages fetched`))
  }

  // --- briefs: existence, size, and GROUNDING (every $-figure must exist in source context) ---
  const briefsDir = 'output/briefs'
  if (existsSync(briefsDir)) {
    const briefFiles = readdirSync(briefsDir).filter(f => f.endsWith('.html') && f !== 'index.html')
    const small = briefFiles.filter(f => statSync(join(briefsDir, f)).size < 5_000)
    checks.push({
      name: 'briefs: file size',
      status: briefFiles.length > 0 && small.length === 0 ? 'pass' : 'warn',
      detail: `${briefFiles.length} briefs, ${small.length} under 5KB`,
    })

    const contexts = loadJson<Record<string, string>>('data/brief-contexts.json')
    if (contexts) {
      let hallucinated = 0
      const offenders: string[] = []
      for (const file of briefFiles) {
        const crd = file.match(/-(\d+)-/)?.[1]
        const context = crd ? contexts[crd] : undefined
        if (!context) continue
        const html = readFileSync(join(briefsDir, file), 'utf8')
        const briefBody = html.replace(/<[^>]+>/g, ' ')
        const normalize = (s: string) => s.replace(/[,\s]/g, '')
        const ctxNorm = normalize(context)
        // Every dollar figure AND every percentage must trace verbatim to source —
        // a hallucinated "72% HNW" is as damaging as a hallucinated $-figure.
        const dollarFigs = briefBody.match(/\$[\d,.]+\s*(?:billion|million|B|M)?/gi) ?? []
        const pctFigs = briefBody.match(/\b\d{1,3}(?:\.\d+)?\s*%/g) ?? []
        for (const fig of [...dollarFigs, ...pctFigs]) {
          // strip a sentence-final period the regex greedily captured ("$465,000." → "$465000")
          const probe = normalize(fig).replace(/(billion|million|B|M)$/i, '').replace(/\.$/, '')
          if (!ctxNorm.includes(probe)) {
            hallucinated++
            offenders.push(`${file}: ${fig.trim()}`)
            break
          }
        }
      }
      checks.push({
        name: 'briefs: grounding (figures traceable to source)',
        status: hallucinated === 0 ? 'pass' : 'fail',
        detail: hallucinated === 0 ? 'every dollar figure and percentage appears in its source context' : `ungrounded figures: ${offenders.join('; ')}`,
      })
    }
  }

  return checks
}

export function printValidationReport(checks: Check[]): boolean {
  const icon: Record<CheckStatus, string> = { pass: '✅', warn: '⚠️ ', fail: '❌' }
  console.log('\n── validation ───────────────────────────────────────────')
  for (const c of checks) console.log(` ${icon[c.status]} ${c.name} — ${c.detail}`)
  const fails = checks.filter(c => c.status === 'fail').length
  const warns = checks.filter(c => c.status === 'warn').length
  console.log(`─────────────────────────────────────────────────────────`)
  console.log(` ${checks.length} checks · ${fails} fail · ${warns} warn\n`)
  return fails === 0
}
