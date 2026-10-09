/** Checks complete financial quantities, preserving million/billion units.
 * Numeric traceability is not proof of the surrounding narrative. */
const QUANTITY = /\$\d[\d,.]*(?:[ \t]*(?:billion|million|thousand|B|M|K)\b)?|\b\d+(?:\.\d+)?[ \t]*%/gi
function canonical(raw: string): string | null {
  const percent = raw.endsWith('%')
  const match = raw.match(/^\$?([\d,.]+)\s*(billion|million|thousand|B|M|K|%)?$/i)
  if (!match) return null
  const numeric = match[1].replace(/\.$/, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(numeric)) return null
  const unit = (match[2] ?? '').toLowerCase()
  const multiplier = ['b','billion'].includes(unit) ? 1e9 : ['m','million'].includes(unit) ? 1e6 : ['k','thousand'].includes(unit) ? 1e3 : 1
  const value = Number(numeric.replace(/,/g,'')) * multiplier
  return Number.isFinite(value) ? `${percent ? 'percent' : 'money'}:${value}` : null
}
export function unsupportedFigures(text: string, source: string | undefined): string[] {
  if (!source?.trim()) return ['source context missing']
  const known = new Set((source.match(QUANTITY) ?? []).map(canonical).filter(Boolean))
  return (text.match(QUANTITY) ?? []).filter(raw => { const value = canonical(raw); return !value || !known.has(value) })
}
