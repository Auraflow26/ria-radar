export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export function isFresh(fetchedAt: string | undefined | null, now = Date.now()): boolean {
  const stamp = fetchedAt ? Date.parse(fetchedAt) : NaN
  return Number.isFinite(stamp) && stamp <= now && now - stamp < CACHE_MAX_AGE_MS
}
export function normalizeWebsite(url: string): string {
  const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Website must use HTTP(S)')
  return parsed.href
}
