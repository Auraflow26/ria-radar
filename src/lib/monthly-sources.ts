import { JSDOM } from 'jsdom'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SEC_USER_AGENT, type MonthlySource } from '../../config/sources.js'

export const SOURCE_INDEX = 'https://www.sec.gov/data-research/sec-markets-data/information-about-registered-investment-advisers-exempt-reporting-advisers'
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
/** Read the published links. SEC names vary: never generate a ZIP filename. */
export function parseMonthlySources(html: string): { current: MonthlySource; prior: MonthlySource } {
  const doc = new JSDOM(html).window.document
  const sources = new Map<string, MonthlySource>()
  for (const link of doc.querySelectorAll('a[href]')) {
    const match = link.textContent?.trim().match(/^Registered Investment Advisers,\s*(\w+)\s+(\d{4})$/i)
    if (!match) continue
    const month = MONTHS.findIndex(m => m.toLowerCase() === match[1].toLowerCase()) + 1
    if (!month) continue
    const url = new URL(link.getAttribute('href')!, SOURCE_INDEX)
    if (url.hostname !== 'www.sec.gov' || url.protocol !== 'https:' || !url.pathname.endsWith('.zip')) continue
    const label = `${match[2]}-${String(month).padStart(2,'0')}`
    sources.set(label, { label, url: url.href })
  }
  const sorted = [...sources.values()].sort((a,b) => b.label.localeCompare(a.label))
  if (sorted.length < 2) throw new Error('SEC index does not contain two registered-adviser ZIP links')
  const [current, prior] = sorted
  const [year, month] = current.label.split('-').map(Number)
  const expectedPrior = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0,7)
  if (prior.label !== expectedPrior) throw new Error('SEC source months are not consecutive; growth comparison refused')
  return { current, prior }
}
export async function resolveMonthlySources(): Promise<{ current: MonthlySource; prior: MonthlySource }> {
  const file = 'data/source-manifest.json'
  if (process.env.RIA_RADAR_OFFLINE === '1') {
    if (!existsSync(file)) throw new Error('--offline: source-manifest.json missing')
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  const response = await fetch(SOURCE_INDEX, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`SEC source index HTTP ${response.status}; use a verified cached manifest offline, never guess URLs`)
  const sources = parseMonthlySources(await response.text())
  mkdirSync('data', { recursive: true })
  writeFileSync(file, JSON.stringify({ ...sources, checkedAt: new Date().toISOString(), index: SOURCE_INDEX },null,2))
  return sources
}
