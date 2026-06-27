// [KKR-RIA] Agentic enrichment planner — auraflow forced-schema agent technique.
//
// Opt-in (KKR_AGENTIC_ENRICH=1). Per firm, an Opus tool-use agent decides WHICH
// enrichment actions are worth running, given what's already known. It NEVER
// produces firm data — it only returns a structured PLAN; the deterministic
// fetchers (live PDF, homepage, Apify fallback) still do the actual fetching and
// the grounding gate still validates every number. The agent saves spend (skip a
// homepage fetch for a firm with no website) and adds a logged rationale, without
// ever becoming a trusted data source.
//
// Same discipline as the brief agent: forced tool_choice + a strict schema, so
// the model can only answer in the allowed shape.

import Anthropic from '@anthropic-ai/sdk'
import { MODEL } from './claude.js'
import type { ScoredFirm } from '../types.js'

export interface EnrichPlan {
  fetch_pdf: boolean // pull the live ADV PDF (custodians + Schedule D 7.B)?
  fetch_homepage: boolean // scan the firm homepage for alts/competitor language?
  priority: 'high' | 'normal' | 'low' // wholesaler-facing priority hint
  reason: string // one line, logged for auditability
}

const PLAN_TOOL: Anthropic.Tool = {
  name: 'submit_enrich_plan',
  description: 'Decide which enrichment actions to run for this RIA firm. Choose actions only; never invent firm data.',
  input_schema: {
    type: 'object',
    properties: {
      fetch_pdf: { type: 'boolean', description: 'Fetch the full ADV PDF (custodians + Schedule D 7.B fund detail).' },
      fetch_homepage: {
        type: 'boolean',
        description: 'Scan the firm homepage. Set false if the firm has no website on file (would waste a fetch).',
      },
      priority: { type: 'string', enum: ['high', 'normal', 'low'], description: 'Coverage priority for a wholesaler.' },
      reason: { type: 'string', description: 'One sentence justifying the plan, grounded in the firm summary provided.' },
    },
    required: ['fetch_pdf', 'fetch_homepage', 'priority', 'reason'],
    additionalProperties: false,
  },
}

const RULES = `You are an enrichment planner for an alternatives-distribution data pipeline.
For the RIA firm summarized below, decide which enrichment actions are worth running.

RULES:
- You choose ACTIONS only. You never produce or guess firm data.
- fetch_homepage MUST be false when the summary says the firm has no website.
- Prefer fetch_pdf for firms with private-fund exposure or high HNW mix (custodian + fund detail matter most there).
- priority reflects how attractive this firm is as a first call, given only the summary.
- reason: one sentence, grounded in the summary.`

function firmSummary(s: ScoredFirm): string {
  const f = s.firm
  return [
    `Name: ${f.name} (${[f.city, f.state].filter(Boolean).join(', ') || 'location n/a'})`,
    `Composite score: ${s.total.toFixed(0)}/100`,
    `Total RAUM: ${f.raumTotal !== null ? `$${(f.raumTotal / 1e9).toFixed(1)}B` : 'not reported'}`,
    `HNW RAUM: ${f.raumHnw !== null ? `$${(f.raumHnw / 1e9).toFixed(1)}B` : 'not reported'}`,
    `Advises private funds: ${f.advisesPrivateFunds === null ? 'unknown' : f.advisesPrivateFunds ? 'yes' : 'no'} · count ${f.privateFundCount ?? 0}`,
    `Website on file: ${f.website ? 'yes' : 'NO'}`,
  ].join('\n')
}

/** Conservative default when the agent is off or errors: fetch both if data exists. */
export function defaultPlan(s: ScoredFirm): EnrichPlan {
  return {
    fetch_pdf: true,
    fetch_homepage: Boolean(s.firm.website),
    priority: s.total >= 70 ? 'high' : s.total >= 50 ? 'normal' : 'low',
    reason: 'deterministic default plan (agent disabled)',
  }
}

let client: Anthropic | null = null

/** True when agentic enrichment is enabled AND an API key is present. */
export function agenticEnabled(): boolean {
  return process.env.KKR_AGENTIC_ENRICH === '1' && Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Ask the agent for an enrichment plan. Falls back to defaultPlan() on any
 * failure — the pipeline never blocks on the planner. The homepage-without-website
 * guard is enforced in code regardless of what the model returns.
 */
export async function planEnrichment(s: ScoredFirm): Promise<EnrichPlan> {
  if (!agenticEnabled()) return defaultPlan(s)
  try {
    client ??= new Anthropic()
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'submit_enrich_plan' },
      messages: [{ role: 'user', content: `${RULES}\n\n=== FIRM SUMMARY ===\n${firmSummary(s)}` }],
    })
    const toolUse = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_enrich_plan',
    )
    if (!toolUse) return defaultPlan(s)
    const plan = toolUse.input as EnrichPlan
    // hard guard: never fetch a homepage the firm doesn't have, whatever the model said
    if (!s.firm.website) plan.fetch_homepage = false
    return plan
  } catch (err) {
    console.warn(`  ⚠ enrich planner failed for ${s.firm.name}: ${(err as Error).message} — default plan`)
    return defaultPlan(s)
  }
}
