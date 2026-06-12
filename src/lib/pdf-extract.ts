import { createRequire } from 'node:module'
import { CUSTODIANS } from '../../config/custodians.js'

// pdf-parse is CommonJS; its ESM entry tries to run a debug harness — require() the lib directly
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')

export interface PdfExtraction {
  custodians: { name: string; tier: 1 | 2; platformNote?: string }[]
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
  return { custodians }
}
