import 'dotenv/config'
import { setOffline } from '../src/lib/sec-client.js'

/**
 * Pipeline orchestrator.
 *
 *   npx tsx scripts/run.ts                          # all stages
 *   npx tsx scripts/run.ts --stage ingest,score     # selected stages
 *   npx tsx scripts/run.ts --stage briefs --top 5   # top-5 briefs only
 *   npx tsx scripts/run.ts --offline                # cache only, no network
 *   npx tsx scripts/run.ts --dry-run                # print plan, do nothing
 *   npx tsx scripts/run.ts --with-bulk --stage ingest # +1.4GB SEC structured bulk (stale 2024-12)
 */

const ALL_STAGES = ['ingest', 'score', 'enrich', 'briefs', 'validate'] as const
type Stage = (typeof ALL_STAGES)[number]

function parseArgs(argv: string[]) {
  const args = {
    stages: [...ALL_STAGES] as Stage[],
    top: undefined as number | undefined,
    dryRun: false,
    offline: false,
    withBulk: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--stage') {
      const list = (argv[++i] ?? '').split(',').map(s => s.trim()) as Stage[]
      const bad = list.filter(s => !ALL_STAGES.includes(s))
      if (bad.length) throw new Error(`unknown stage(s): ${bad.join(', ')} (valid: ${ALL_STAGES.join(', ')})`)
      args.stages = list
    } else if (a === '--top') args.top = Number.parseInt(argv[++i] ?? '', 10)
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--offline') args.offline = true
    else if (a === '--with-bulk') args.withBulk = true
    else throw new Error(`unknown flag: ${a}`)
  }
  return args
}

const args = parseArgs(process.argv)
setOffline(args.offline)
if (args.offline) process.env.RIA_RADAR_OFFLINE = '1'

console.log(`ria-radar pipeline — stages: ${args.stages.join(' → ')}${args.offline ? ' (offline)' : ''}`)

if (args.dryRun) {
  console.log('--dry-run: stopping before execution')
  process.exit(0)
}

for (const stage of args.stages) {
  if (stage === 'ingest') await (await import('./stage1-ingest.js')).runIngest({ withBulk: args.withBulk })
  else if (stage === 'score') await (await import('./stage2-score.js')).runScore()
  else if (stage === 'enrich') await (await import('./stage3-enrich.js')).runEnrich(args.top)
  else if (stage === 'briefs') await (await import('./stage4-briefs.js')).runBriefs(args.top)
  else if (stage === 'validate') {
    const { runValidation, printValidationReport } = await import('../src/lib/validation.js')
    const ok = printValidationReport(runValidation())
    if (!ok) process.exitCode = 1
  }
}
