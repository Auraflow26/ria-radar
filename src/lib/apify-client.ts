import { writeFile, readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const APIFY_BASE = 'https://api.apify.com/v2'
// website-content-crawler: renders JS, returns cleaned text/markdown
const ACTOR = 'apify~website-content-crawler'
const WEB_DIR = join('data', 'web')

/** True when raw-fetch HTML looks like an unrendered SPA shell. */
export function looksLikeEmptyShell(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  // Heuristics: tiny text body, or a known SPA root with no content
  if (text.length < 600) return true
  if (/<div id="root">\s*<\/div>|<div id="__next">\s*<\/div>/i.test(html) && text.length < 1500) return true
  return false
}

/**
 * Fetch a homepage through Apify's JS-rendering crawler. Cached to
 * data/web/{crd}.apify.json. Returns plain text (already cleaned).
 * Throws on any failure so the caller can fall back to the raw-fetch result.
 */
export async function fetchHomepageViaApify(crd: number, url: string): Promise<string> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not set')

  const cachePath = join(WEB_DIR, `${crd}.apify.json`)
  if (existsSync(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'))
    return cached.text ?? ''
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const runUrl = `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`
  const res = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: normalized }],
      maxCrawlPages: 1, // homepage only — keep cost minimal
      maxCrawlDepth: 0, // don't follow links off the homepage
      crawlerType: 'playwright:firefox',
      saveMarkdown: true,
      // proxyConfiguration is REQUIRED by the actor schema
      proxyConfiguration: { useApifyProxy: true },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Apify HTTP ${res.status} for ${normalized}`)
  const items = (await res.json()) as Array<{ text?: string; markdown?: string }>
  const text = items[0]?.text ?? items[0]?.markdown ?? ''
  if (!text) throw new Error(`Apify returned no content for ${normalized}`)

  mkdirSync(WEB_DIR, { recursive: true })
  await writeFile(cachePath, JSON.stringify({ text, fetchedVia: 'apify' }))
  return text
}
