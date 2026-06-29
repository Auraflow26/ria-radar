// [KKR-RIA] Watchlist / ADV-change alerts (#1).
// Diffs the current scored firms against the last snapshot and emits an alert
// for each trigger crossed: RAUM jump >15%, new private fund, custodian change,
// or a newer ADV filing. Writes alerts + refreshes the snapshot in Supabase, and
// pings Slack if SLACK_WEBHOOK_HIGH_RISK is set. Public SEC data only.
//
//   doppler run -- npx tsx scripts/watch.ts

import { readFileSync } from 'node:fs'
import { selectAll, upsert, insertRows, hasSupabase } from '../src/lib/supabase-client.js'
import type { ScoredFirm } from '../src/types.js'

const RAUM_JUMP = 0.15

interface Snapshot {
  crd: number; raum_total: number | null; private_fund_count: number | null
  custodians: string | null; filing_date: string | null
}
interface Alert { crd: number; name: string; kind: string; detail: string }

const custodianStr = (s: ScoredFirm) =>
  (s.enrichment?.custodians ?? []).map(c => c.name).sort().join(', ') || null

async function slack(alerts: Alert[]): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_HIGH_RISK
  if (!url || alerts.length === 0) return
  const lines = alerts.map(a => `• *${a.name}* — ${a.detail}`).join('\n')
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `:rotating_light: RIA Radar — ${alerts.length} ADV change(s):\n${lines}` }),
  }).catch(() => {})
}

async function main() {
  if (!hasSupabase()) {
    console.error('watch: SUPABASE_* not set — nothing to diff against.')
    process.exit(1)
  }
  const scored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json', 'utf8'))
  const current = scored.slice(0, 500)

  const prevRows = await selectAll<Snapshot>('kkr_ria_snapshots', 'crd,raum_total,private_fund_count,custodians,filing_date')
  const prev = new Map(prevRows.map(r => [r.crd, r]))

  const alerts: Alert[] = []
  const snapshots: Snapshot[] = []

  for (const s of current) {
    const f = s.firm
    const cust = custodianStr(s)
    snapshots.push({
      crd: f.crd, raum_total: f.raumTotal, private_fund_count: f.privateFundCount ?? null,
      custodians: cust, filing_date: f.filingDate ?? null,
    })
    const p = prev.get(f.crd)
    if (!p) continue // first time seen — snapshot only, no alert

    if (p.raum_total && f.raumTotal && Math.abs(f.raumTotal / p.raum_total - 1) >= RAUM_JUMP) {
      const pct = Math.round((f.raumTotal / p.raum_total - 1) * 100)
      alerts.push({ crd: f.crd, name: f.name, kind: 'raum_jump', detail: `RAUM ${pct > 0 ? '+' : ''}${pct}% to $${((f.raumTotal) / 1e9).toFixed(1)}B` })
    }
    if ((f.privateFundCount ?? 0) > (p.private_fund_count ?? 0)) {
      alerts.push({ crd: f.crd, name: f.name, kind: 'new_fund', detail: `Private funds ${p.private_fund_count ?? 0} → ${f.privateFundCount}` })
    }
    if (cust && p.custodians && cust !== p.custodians) {
      alerts.push({ crd: f.crd, name: f.name, kind: 'custodian_change', detail: `Custodian: ${p.custodians} → ${cust}` })
    }
    if (f.filingDate && p.filing_date && f.filingDate > p.filing_date) {
      alerts.push({ crd: f.crd, name: f.name, kind: 'new_filing', detail: `New ADV filed ${f.filingDate}` })
    }
  }

  await upsert('kkr_ria_snapshots', snapshots, 'crd')
  if (alerts.length) await insertRows('kkr_ria_alerts', alerts)
  await slack(alerts)

  console.log(`watch: ${snapshots.length} snapshots refreshed, ${alerts.length} alert(s) raised`)
  for (const a of alerts) console.log(`  ⚠ ${a.name}: ${a.detail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
