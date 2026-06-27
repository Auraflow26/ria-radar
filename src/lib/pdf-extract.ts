import { createRequire } from 'node:module'
import { CUSTODIANS } from '../../config/custodians.js'

// pdf-parse is CommonJS; its ESM entry tries to run a debug harness — require() the lib directly
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')

export interface PdfFundDetail {
  peFunds: number | null
  privateCreditFunds: number | null // 'private credit'/'debt'/'lending' fund descriptions
  realEstateFunds: number | null
  hedgeFunds: number | null
  totalPrivateFundGrossAssets: number | null
}

export interface PdfExtraction {
  custodians: { name: string; tier: 1 | 2; platformNote?: string }[]
  fundDetail: PdfFundDetail
}

const EMPTY_FUND_DETAIL: PdfFundDetail = {
  peFunds: null,
  privateCreditFunds: null,
  realEstateFunds: null,
  hedgeFunds: null,
  totalPrivateFundGrossAssets: null,
}

/**
 * Parse Schedule D Section 7.B.(1) private-fund detail. Counts fund-type rows
 * by their disclosed fund-type descriptor and sums gross-asset figures.
 * Returns null per field when the region or a figure can't be found — never
 * invents a value. Every number surfaced here must still survive the brief's
 * grounding gate (appear verbatim in the firm context string).
 */
function extractFundDetail(text: string): PdfFundDetail {
  const start = text.search(/Section\s*7\.B\.?\(1\)|SECTION\s*7\.B\.?\(1\)|Item\s*7\.B\.?\(1\)/)
  if (start < 0) return { ...EMPTY_FUND_DETAIL }
  // bound the region: next major section header, or a fixed window
  const rest = text.slice(start + 10)
  const endRel = rest.search(/Section\s*7\.B\.?\(2\)|SECTION\s*8|Item\s*8/)
  const region = endRel >= 0 ? text.slice(start, start + 10 + endRel) : text.slice(start, start + 60_000)

  // count fund-type descriptors (ADV 7.B uses controlled fund-type labels)
  const count = (re: RegExp): number | null => {
    const m = region.match(re)
    return m ? m.length : null
  }
  const peFunds = count(/private\s+equity\s+fund/gi)
  const privateCreditFunds = count(/(private\s+credit|credit\s+fund|debt\s+fund|lending\s+fund)/gi)
  const realEstateFunds = count(/real\s+estate\s+fund/gi)
  const hedgeFunds = count(/hedge\s+fund/gi)

  // sum gross-asset dollar figures within the region (e.g. "$ 1,234,567,890")
  let totalPrivateFundGrossAssets: number | null = null
  const grossMatches = region.match(/\$\s?[\d,]{7,}/g)
  if (grossMatches && grossMatches.length) {
    const sum = grossMatches
      .map(s => Number.parseInt(s.replace(/[^\d]/g, ''), 10))
      .filter(n => Number.isFinite(n) && n > 0)
      .reduce((a, b) => a + b, 0)
    totalPrivateFundGrossAssets = sum > 0 ? sum : null
  }

  return { peFunds, privateCreditFunds, realEstateFunds, hedgeFunds, totalPrivateFundGrossAssets }
}

/**
 * Pull custodian names out of a firm's full ADV PDF.
 * Strategy: locate the Schedule D Section 5.K.(3) region (separately managed
 * account custodians) and dictionary-match within it; if the section header
 * isn't found (layout drift), fall back to matching across the whole text —
 * noisier but still useful, since 5.K(3) names dominate custodian mentions.
 */
export async function extractFromAdvPdf(pdf: Buffer): Promise<PdfExtraction> {
  const { text } = await pdfParse(pdf)

  let searchText = text
  const sectionStart = text.search(/Section\s*5\.K\.?\(3\)|SECTION\s*5\.K\.?\(3\)/)
  if (sectionStart >= 0) {
    const sectionEnd = text.indexOf('SECTION 6', sectionStart)
    searchText = text.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : sectionStart + 20_000)
  }

  const custodians: PdfExtraction['custodians'] = []
  for (const c of CUSTODIANS) {
    if (c.patterns.some(p => p.test(searchText))) {
      custodians.push({ name: c.name, tier: c.tier, platformNote: c.platformNote })
    }
  }
  return { custodians, fundDetail: extractFundDetail(text) }
}
