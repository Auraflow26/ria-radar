import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { runValidation, printValidationReport } from '../src/lib/validation.js'
import { unsupportedFigures } from '../src/lib/grounding.js'
import { rankedFirmRows } from '../src/lib/persist.js'
import { publishRefresh } from '../src/lib/supabase-client.js'
import { isFresh } from '../src/lib/freshness.js'
import type { ScoredFirm } from '../src/types.js'

// Build a concrete artifact by default. Only --apply calls the write RPC.
const checks = runValidation()
if (!printValidationReport(checks)) throw new Error('Refresh validation failed; nothing published')
const meta = JSON.parse(readFileSync('data/ingest-meta.json','utf8'))
const scored: ScoredFirm[] = JSON.parse(readFileSync('data/scored.json','utf8'))
const briefs = JSON.parse(readFileSync('data/briefs.json','utf8')) as Array<{crd:number;grounded:boolean;brief:unknown;source_context:string;run_snapshot:string}>
if (!scored.length || !briefs.length) throw new Error('Incomplete refresh; no publication')
for (const b of briefs) {
  if (b.run_snapshot !== meta.snapshot || !b.grounded || unsupportedFigures(JSON.stringify(b.brief),b.source_context).length) throw new Error('Brief validation failed; nothing published')
}
if (!isFresh(meta.acquiredAt)) throw new Error('SEC acquisition is not current')
const generation = `${meta.snapshot}@${meta.acquiredAt}`
const firms = rankedFirmRows(scored.slice(0,150),generation)
const currentCrds = new Set(firms.map(f=>f.crd))
if (briefs.some(b=>!currentCrds.has(b.crd))) throw new Error('Brief outside current ranked list; nothing published')
const rows = briefs.filter(b=>currentCrds.has(b.crd)).map(b=>({...b,run_snapshot:generation}))
const artifact = { generation, firms, briefs:rows }
writeFileSync('data/refresh-artifact.json',JSON.stringify(artifact))
if (process.argv.includes('--apply')) console.log(`Published ${await publishRefresh(generation,firms,rows)} firms atomically`)
else console.log('Validated data/refresh-artifact.json prepared; no database writes. Use --apply only after migration and release review.')
