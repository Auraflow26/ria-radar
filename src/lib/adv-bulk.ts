import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ADV_BULK_PARTS, SEC_USER_AGENT } from '../../config/sources.js'
import type { FundDetail } from '../types.js'

const DATA_DIR = 'data'
const RAW_DIR = join(DATA_DIR, 'raw')
const BULK_JSON = join(DATA_DIR, 'schedule-d-bulk.json')

/** One firm's bulk-derived fund/custodian record, keyed by CRD in the output map. */
export interface BulkFirmRecord {
  fundDetail: FundDetail
  custodianNames: string[]
}

export type BulkIndex = Record<string, BulkFirmRecord>

function offlineGuarded(): boolean {
  // adv-bulk respects the same env the orchestrator sets via run.ts --offline
  return process.env.RIA_RADAR_OFFLINE === '1'
}

/**
 * Download + extract both ADV structured-data parts (~1.4GB total). Cached:
 * skips download when the zip already exists, skips extract when the dir exists.
 * Returns the list of extracted directory paths.
 *
 * NOTE: the SEC ships the central directory at the END of the zip, so the full
 * file must download before `unzip` can list it. There is no partial path.
 */
async function downloadAndExtractParts(): Promise<string[]> {
  mkdirSync(RAW_DIR, { recursive: true })
  const dirs: string[] = []
  for (const part of ADV_BULK_PARTS) {
    const extractDir = join(RAW_DIR, part.label)
    if (existsSync(extractDir) && readdirSync(extractDir).length) {
      dirs.push(extractDir)
      continue
    }
    const zipPath = join(RAW_DIR, `${part.label}.zip`)
    if (!existsSync(zipPath)) {
      if (offlineGuarded()) throw new Error(`--offline: ${part.label} zip not in cache`)
      console.log(`  ↓ downloading ${part.url} (~700MB — this is slow)`)
      const res = await fetch(part.url, { headers: { 'User-Agent': SEC_USER_AGENT }, redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${part.url}`)
      await writeFile(zipPath, Buffer.from(await res.arrayBuffer()))
      console.log(`  ✓ ${part.label}.zip (${(statSync(zipPath).size / 1e6).toFixed(0)}MB)`)
    }
    mkdirSync(extractDir, { recursive: true })
    console.log(`  ⇲ extracting ${part.label}…`)
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir])
    dirs.push(extractDir)
  }
  return dirs
}

const emptyFundDetail = (): FundDetail => ({
  peFunds: null,
  privateCreditFunds: null,
  realEstateFunds: null,
  hedgeFunds: null,
  totalPrivateFundGrossAssets: null,
})

/**
 * Find data files inside the extracted bulk dirs. The exact inner layout can't
 * be confirmed before download (central dir at file end), so we recurse and
 * collect CSV files — the SEC structured ADV bulk is CSV-per-table.
 */
function findCsvFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findCsvFiles(full))
    else if (entry.name.toLowerCase().endsWith('.csv')) out.push(full)
  }
  return out
}

/** Locate a column index by trying several header-name candidates (case-insensitive substring). */
function colIndex(header: string[], candidates: string[]): number {
  const lower = header.map(h => h.toLowerCase())
  for (const c of candidates) {
    const idx = lower.findIndex(h => h.includes(c.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

function splitCsvLine(line: string): string[] {
  // minimal CSV: handles quoted fields with embedded commas
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/**
 * Parse the extracted bulk CSVs into a CRD-keyed index of Schedule D 7.B fund
 * detail. Heuristic on column names (the bulk schema is unconfirmed); logs the
 * headers it actually finds so the parser can be tightened against real data.
 * Any file it can't interpret is skipped, not fatal.
 */
async function parseBulk(dirs: string[]): Promise<BulkIndex> {
  const index: BulkIndex = {}
  for (const dir of dirs) {
    for (const csv of findCsvFiles(dir)) {
      let content: string
      try {
        content = await readFile(csv, 'utf8')
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      if (lines.length < 2) continue
      const header = splitCsvLine(lines[0])
      const crdCol = colIndex(header, ['crd', 'organization crd', 'firm crd'])
      if (crdCol < 0) continue // not a firm-keyed table

      const fundTypeCol = colIndex(header, ['fund type', 'private fund type', '7.b'])
      const grossCol = colIndex(header, ['gross asset', 'gross asset value', '11.a', 'fund gross'])
      console.log(
        `  · ${csv.split('/').pop()}: crd@${crdCol}` +
          `${fundTypeCol >= 0 ? ` fundType@${fundTypeCol}` : ''}${grossCol >= 0 ? ` gross@${grossCol}` : ''}` +
          ` (${lines.length - 1} rows)`,
      )
      if (fundTypeCol < 0 && grossCol < 0) continue // nothing useful here

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue
        const cells = splitCsvLine(lines[i])
        const crd = cells[crdCol]?.replace(/[^\d]/g, '')
        if (!crd) continue
        const rec = (index[crd] ??= { fundDetail: emptyFundDetail(), custodianNames: [] })
        const fd = rec.fundDetail

        if (fundTypeCol >= 0) {
          const t = (cells[fundTypeCol] ?? '').toLowerCase()
          if (/private\s+equity/.test(t)) fd.peFunds = (fd.peFunds ?? 0) + 1
          else if (/(private\s+credit|debt|lending)/.test(t)) fd.privateCreditFunds = (fd.privateCreditFunds ?? 0) + 1
          else if (/real\s+estate/.test(t)) fd.realEstateFunds = (fd.realEstateFunds ?? 0) + 1
          else if (/hedge/.test(t)) fd.hedgeFunds = (fd.hedgeFunds ?? 0) + 1
        }
        if (grossCol >= 0) {
          const g = Number.parseInt((cells[grossCol] ?? '').replace(/[^\d]/g, ''), 10)
          if (Number.isFinite(g) && g > 0) fd.totalPrivateFundGrossAssets = (fd.totalPrivateFundGrossAssets ?? 0) + g
        }
      }
    }
  }
  return index
}

/**
 * Build (or load from cache) the CRD-keyed bulk Schedule D index.
 * STALE: covers filings thru 2024-12. Use only as a fallback for firms the
 * live-PDF enrich pass didn't touch; the caller must tag the staleness.
 */
export async function buildBulkIndex(): Promise<BulkIndex> {
  if (existsSync(BULK_JSON)) {
    return JSON.parse(await readFile(BULK_JSON, 'utf8'))
  }
  const dirs = await downloadAndExtractParts()
  const index = await parseBulk(dirs)
  const n = Object.keys(index).length
  mkdirSync(DATA_DIR, { recursive: true })
  await writeFile(BULK_JSON, JSON.stringify(index))
  console.log(`  ✓ ${BULK_JSON} — ${n.toLocaleString()} firms with bulk Schedule D detail (stale 2024-12)`)
  if (n === 0) console.warn('  ⚠ bulk parse produced 0 firms — inner schema differs from heuristics; inspect headers logged above')
  return index
}
