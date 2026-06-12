import { createReadStream } from 'node:fs'
import { parse } from 'csv-parse'
import { AdvFirmSchema, type AdvFirm } from '../types.js'

/**
 * Parse the SEC monthly FOIA roster CSV into typed firms.
 *
 * Format facts (verified against the June 2026 file):
 * - 452 quoted columns, embedded commas/newlines inside quoted fields
 * - money fields are space-padded strings like "   576,373,248.00"; a bare
 *   "      .00" means zero, empty string means not reported
 * - the OLD 5D layout (`5D(a)(1)` … `5D(n)(3)`) is the live one; the new
 *   `5D(1)(x)/5D(2)(x)` columns are populated on ~1 row — we read old only
 * - column order is not guaranteed across months: header-name access only
 */

/** "   1,234,567.00" → 1234567 ; "" → null ; "      .00" → 0 */
function money(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const cleaned = raw.replace(/[\s,]/g, '')
  if (cleaned === '') return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function int(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const cleaned = raw.replace(/[\s,]/g, '')
  if (cleaned === '') return null
  const n = Number.parseInt(cleaned, 10)
  return Number.isFinite(n) ? n : null
}

function yn(raw: string | undefined): boolean | null {
  const v = raw?.trim().toUpperCase()
  if (v === 'Y') return true
  if (v === 'N') return false
  return null
}

function str(raw: string | undefined): string | null {
  const v = raw?.trim()
  return v ? v : null
}

export async function parseRosterCsv(csvPath: string): Promise<AdvFirm[]> {
  const parser = createReadStream(csvPath).pipe(
    parse({
      bom: true,
      columns: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
      trim: false,
    }),
  )

  const firms: AdvFirm[] = []
  let skipped = 0

  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const crd = int(row['Organization CRD#'])
    const name = str(row['Primary Business Name'])
    if (crd === null || name === null) {
      skipped++
      continue
    }

    const firm = AdvFirmSchema.safeParse({
      crd,
      name,
      legalName: str(row['Legal Name']),
      city: str(row['Main Office City']),
      state: str(row['Main Office State']),
      country: str(row['Main Office Country']),
      website: str(row['Website Address']),
      filingDate: str(row['Latest ADV Filing Date']),
      secStatus: str(row['SEC Current Status']),
      employees: int(row['5A']),
      raumTotal: money(row['5F(2)(c)']),
      raumDiscretionary: money(row['5F(2)(a)']),
      raumNonDiscretionary: money(row['5F(2)(b)']),
      clientsIndividual: int(row['5D(a)(1)']),
      raumIndividual: money(row['5D(a)(3)']),
      clientsHnw: int(row['5D(b)(1)']),
      raumHnw: money(row['5D(b)(3)']),
      clientsPooled: int(row['5D(f)(1)']),
      raumPooled: money(row['5D(f)(3)']),
      advisesPrivateFunds: yn(row['7B']),
      privateFundCount: int(row['Count of Private Funds - 7B(1)']),
      peFundCount: int(row['Total number of PE funds']),
      hedgeFundCount: int(row['Total number of Hedge funds']),
      realEstateFundCount: int(row['Total number of Real Estate funds']),
      privateFundGrossAssets: money(row['Total Gross Assets of Private Funds']),
      pctSmaPooledVehicles: money(row['5.K.(1)(a)(x) end year percentage']),
    })

    if (firm.success) firms.push(firm.data)
    else skipped++
  }

  if (skipped > 0) console.warn(`  ⚠ skipped ${skipped} unparseable rows in ${csvPath}`)
  return firms
}
