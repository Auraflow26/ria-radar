import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SEC_USER_AGENT, SEC_REQUESTS_PER_SECOND, advPdfUrl, type MonthlySource } from '../../config/sources.js'
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
  if (existsSync(extractDir)) {
    const csv = readdirSync(extractDir).find(f => f.toUpperCase().endsWith('.CSV'))
    if (csv) return join(extractDir, csv)
  }

  assertOnline(`monthly roster ${source.label}`)
  mkdirSync(RAW_DIR, { recursive: true })
  const zipPath = join(RAW_DIR, `${source.label}.zip`)
  if (!existsSync(zipPath)) {
    console.log(`  ↓ downloading ${source.url}`)
    const res = await withRetry(() => secLimiter.withRateLimit(() => fetchWithUa(source.url)), {
      label: `roster ${source.label}`,
    })
    await writeFile(zipPath, Buffer.from(await res.arrayBuffer()))
  }
  mkdirSync(extractDir, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir])
  const csv = readdirSync(extractDir).find(f => f.toUpperCase().endsWith('.CSV'))
  if (!csv) throw new Error(`no CSV found inside ${zipPath}`)
  return join(extractDir, csv)
}

/** Fetch a firm's full ADV PDF (cached to data/pdfs/{crd}.pdf). */
export async function fetchAdvPdf(crd: number): Promise<Buffer> {
  const pdfDir = join(DATA_DIR, 'pdfs')
  const pdfPath = join(pdfDir, `${crd}.pdf`)
  if (existsSync(pdfPath)) return readFile(pdfPath)

  assertOnline(`ADV PDF for CRD ${crd}`)
  mkdirSync(pdfDir, { recursive: true })
  const res = await withRetry(() => secLimiter.withRateLimit(() => fetchWithUa(advPdfUrl(crd))), {
    label: `ADV PDF ${crd}`,
    maxRetries: 2,
  })
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(pdfPath, buf)
  return buf
}

/** Fetch a firm homepage with a hard timeout (cached to data/web/{crd}.html). */
export async function fetchHomepage(crd: number, url: string): Promise<string> {
  const webDir = join(DATA_DIR, 'web')
  const htmlPath = join(webDir, `${crd}.html`)
  if (existsSync(htmlPath)) return readFile(htmlPath, 'utf8')

  assertOnline(`homepage for CRD ${crd}`)
  mkdirSync(webDir, { recursive: true })
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const res = await webLimiter.withRateLimit(() =>
    fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ria-radar-demo)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    }),
  )
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${normalized}`)
  const html = await res.text()
  await writeFile(htmlPath, html)
  return html
}
