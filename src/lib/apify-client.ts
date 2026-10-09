import { writeFile, readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { isFresh, normalizeWebsite } from './freshness.js'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR = 'apify~website-content-crawler'
const WEB_DIR = join('data', 'web')
export interface ApifyReceipt {
  text: string; fetchedVia: 'apify'; url: string; fetchedAt: string
  runId: string; datasetId: string
}
interface Run { id: string; status: string; defaultDatasetId: string; finishedAt?: string }
export function looksLikeEmptyShell(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length < 600 || (/<div id="(?:root|__next)">\s*<\/div>/i.test(html) && text.length < 1500)
}
/** One homepage only. Save the actor receipt before polling, so retries resume
 * that run rather than launching another charged scrape after a lost reply. */
export async function fetchHomepageViaApify(crd: number, inputUrl: string, opts: { refresh?: boolean } = {}): Promise<ApifyReceipt> {
  const url = normalizeWebsite(inputUrl)
  const cachePath = join(WEB_DIR, `${crd}.apify.json`)
  if (existsSync(cachePath) && !opts.refresh) {
    const cached = JSON.parse(await readFile(cachePath, 'utf8')) as ApifyReceipt
    if (cached.url === url && cached.text && cached.runId && isFresh(cached.fetchedAt)) return cached
  }
  if (process.env.RIA_RADAR_OFFLINE === '1') throw new Error('--offline: fresh Apify cache unavailable')
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not set')
  const cap = Number(process.env.APIFY_MAX_CHARGE_USD ?? '0.25')
  if (!Number.isFinite(cap) || cap <= 0 || cap > 5) throw new Error('APIFY_MAX_CHARGE_USD must be >0 and <=5')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const api = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${APIFY_BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(65_000) })
    if (!response.ok) throw new Error(`Apify HTTP ${response.status}`)
    return response.json()
  }
  mkdirSync(WEB_DIR, { recursive: true })
  const pendingPath = join(WEB_DIR, `${crd}.apify-pending.json`)
  let run: Run | undefined
  if (existsSync(pendingPath)) {
    const pending = JSON.parse(await readFile(pendingPath, 'utf8'))
    if (pending.url === url) {
      const response = await api(`/actor-runs/${encodeURIComponent(pending.runId)}`)
      run = response.data
      if (run && ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) run = undefined
    }
  }
  if (!run) {
    const response = await api(`/acts/${ACTOR}/runs?timeout=90&maxTotalChargeUsd=${cap}`, {
      method: 'POST', body: JSON.stringify({ startUrls: [{ url }], maxCrawlPages: 1, maxCrawlDepth: 0,
        crawlerType: 'playwright:firefox', saveMarkdown: true, proxyConfiguration: { useApifyProxy: true } }),
    })
    run = response.data as Run
    if (!run?.id || !run.defaultDatasetId) throw new Error('Apify returned an invalid run receipt')
    await writeFile(pendingPath, JSON.stringify({ url, runId: run.id }))
  }
  for (let poll = 0; run.status !== 'SUCCEEDED' && poll < 3; poll++) {
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) throw new Error(`Apify run ${run.id}: ${run.status}`)
    run = (await api(`/actor-runs/${encodeURIComponent(run.id)}?waitForFinish=60`)).data as Run
  }
  if (run.status !== 'SUCCEEDED') throw new Error(`Apify run ${run.id} not finished; retry resumes the saved run`)
  const items = await api(`/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?format=json&clean=true&limit=1`) as Array<{text?: string; markdown?: string}>
  const text = items[0]?.markdown || items[0]?.text || ''
  if (!text.trim()) throw new Error(`Apify run ${run.id} returned no content`)
  const receipt: ApifyReceipt = { text, fetchedVia: 'apify', url, fetchedAt: run.finishedAt ?? new Date().toISOString(), runId: run.id, datasetId: run.defaultDatasetId }
  await writeFile(cachePath, JSON.stringify(receipt))
  // The completed receipt replaces pending state; a fresh scrape may now start.
  await writeFile(pendingPath, JSON.stringify({}))
  return receipt
}
