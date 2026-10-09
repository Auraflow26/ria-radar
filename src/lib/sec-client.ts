import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SEC_USER_AGENT, SEC_REQUESTS_PER_SECOND, advPdfUrl, type MonthlySource } from '../../config/sources.js'
import { isFresh, normalizeWebsite } from './freshness.js'
import { RateLimiter, withRetry } from './rate-limiter.js'

const DATA_DIR = 'data'
const RAW_DIR = join(DATA_DIR, 'raw')

const secLimiter = new RateLimiter(SEC_REQUESTS_PER_SECOND)
const webLimiter = new RateLimiter(4)

let offline = false
export function setOffline(value: boolean): void {
  offline = value
}

function assertOnline(what: string): void {
  if (offline) throw new Error(`--offline: refusing network fetch for ${what} (not in cache)`)
}

async function fetchWithUa(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: { 'User-Agent': SEC_USER_AGENT, ...(init.headers ?? {}) },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res
}

/**
 * Download + unzip a monthly roster (cached: skips download and unzip when
 * the extracted CSV already exists). Returns the path to the extracted CSV.
 */
export async function fetchMonthlyRoster(source: MonthlySource): Promise<string> {
  const extractDir = join(RAW_DIR, source.label)
  const receiptPath = join(RAW_DIR, `${source.label}.receipt.json`)
  if (existsSync(extractDir) && existsSync(receiptPath)) {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
    const csv = readdirSync(extractDir).find(f => f.toUpperCase().endsWith('.CSV'))
    if (csv && receipt.url === source.url && isFresh(receipt.fetchedAt)) return join(extractDir, csv)
  }

  assertOnline(`monthly roster ${source.label}`)
  mkdirSync(RAW_DIR, { recursive: true })
  const zipPath = join(RAW_DIR, `${source.label}.zip`)
  { // A stale/undated ZIP must not be stamped as a new acquisition.
    console.log(`  ↓ downloading ${source.url}`)
    const res = await withRetry(() => secLimiter.withRateLimit(() => fetchWithUa(source.url)), {
      label: `roster ${source.label}`,
    })
    await writeFile(zipPath, Buffer.from(await res.arrayBuffer()))
    await writeFile(receiptPath, JSON.stringify({ url: source.url, fetchedAt: new Date().toISOString() }))
  }
  mkdirSync(extractDir, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir])
  const csv = readdirSync(extractDir).find(f => f.toUpperCase().endsWith('.CSV'))
  if (!csv) throw new Error(`no CSV found inside ${zipPath}`)
  return join(extractDir, csv)
}

/** Fetch a firm's full ADV PDF (cached to data/pdfs/{crd}.pdf). */
export async function fetchAdvPdf(crd: number, opts: { refresh?: boolean } = {}): Promise<Buffer> {
  const pdfDir = join(DATA_DIR, 'pdfs')
  const pdfPath = join(pdfDir, `${crd}.pdf`)
  const receiptPath = `${pdfPath}.receipt.json`
  if (!opts.refresh && existsSync(pdfPath) && existsSync(receiptPath)) {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
    if (isFresh(receipt.fetchedAt)) return readFile(pdfPath)
  }

  assertOnline(`ADV PDF for CRD ${crd}`)
  mkdirSync(pdfDir, { recursive: true })
  const res = await withRetry(() => secLimiter.withRateLimit(() => fetchWithUa(advPdfUrl(crd))), {
    label: `ADV PDF ${crd}`,
    maxRetries: 2,
  })
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(pdfPath, buf)
  await writeFile(receiptPath, JSON.stringify({ fetchedAt: new Date().toISOString(), url: advPdfUrl(crd) }))
  return buf
}

export interface HomepageReceipt { html: string; fetchedAt: string; url: string }
/** Cache by CRD and URL; legacy undated cache cannot claim freshness. */
export async function fetchHomepageRecord(crd: number, inputUrl: string, opts: { refresh?: boolean } = {}): Promise<HomepageReceipt> {
  const webDir = join(DATA_DIR, 'web')
  const htmlPath = join(webDir, `${crd}.html`)
  const receiptPath = `${htmlPath}.receipt.json`
  const url = normalizeWebsite(inputUrl)
  if (!opts.refresh && existsSync(htmlPath) && existsSync(receiptPath)) {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
    if (receipt.url === url && isFresh(receipt.fetchedAt)) return { ...receipt, html: await readFile(htmlPath, 'utf8') }
  }
  assertOnline(`homepage for CRD ${crd}`)
  mkdirSync(webDir, { recursive: true })
  const res = await webLimiter.withRateLimit(() => fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ria-radar-demo)' }, redirect: 'follow', signal: AbortSignal.timeout(10_000),
  }))
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  const receipt = { fetchedAt: new Date().toISOString(), url }
  await writeFile(htmlPath, html)
  await writeFile(receiptPath, JSON.stringify(receipt))
  return { ...receipt, html }
}
export async function fetchHomepage(crd: number, url: string): Promise<string> {
  return (await fetchHomepageRecord(crd, url)).html
}
