import { JSDOM, VirtualConsole } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { ALTS_STRUCTURE_PATTERNS, COMPETITOR_PATTERNS } from '../../config/custodians.js'

export interface WebScan {
  structureHits: string[]
  competitorHits: string[]
}

/** Strip HTML to readable text; fall back to crude tag-stripping. */
export function htmlToText(html: string): string {
  try {
    const vc = new VirtualConsole() // swallow CSS-parse noise from real-world sites
    const dom = new JSDOM(html, { virtualConsole: vc })
    const article = new Readability(dom.window.document).parse()
    const body = dom.window.document.body?.textContent ?? ''
    // Readability extracts the "article"; homepages are nav-heavy, so scan both
    return `${article?.textContent ?? ''}\n${body}`
  } catch {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
  }
}

/** Scan homepage text for retail-alts vehicle structures and competitor shelf traces. */
export function scanForAltsLanguage(html: string): WebScan {
  const text = htmlToText(html)
  const structureHits = ALTS_STRUCTURE_PATTERNS.filter(k => k.pattern.test(text)).map(k => k.label)
  const competitorHits = COMPETITOR_PATTERNS.filter(k => k.pattern.test(text)).map(k => k.label)
  return { structureHits, competitorHits }
}
