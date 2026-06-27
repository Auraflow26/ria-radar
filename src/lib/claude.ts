import Anthropic from '@anthropic-ai/sdk'
import { FirmBriefSchema, type FirmBrief } from '../types.js'

export const MODEL = 'claude-opus-4-8'

const BRIEF_TOOL: Anthropic.Tool = {
  name: 'submit_brief',
  description: 'Submit the structured pre-meeting brief for one RIA firm.',
  input_schema: {
    type: 'object',
    properties: {
      positioning_summary: {
        type: 'string',
        description: "2-3 sentences: who this firm is and how it's positioned, grounded ONLY in the provided data.",
      },
      alts_readiness_bullets: {
        type: 'array',
        items: { type: 'string' },
        description:
          '3-4 bullets on why this firm is alts-ready. EVERY bullet must cite a specific number that appears verbatim in the source context.',
      },
      current_alts_footprint: {
        type: 'string',
        description: 'What the ADV filing and website say the firm already does in alternatives. If nothing, say so plainly.',
      },
      suggested_angle: {
        type: 'string',
        description:
          '2-3 sentences mapping the firm profile to an evergreen-vehicle conversation. NO claims about specific product approvals or platform clearing status — only what the public data supports.',
      },
      conversation_starters: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exactly 3 discovery questions a wholesaler could open with, specific to this firm.',
      },
      caveats: {
        type: 'array',
        items: { type: 'string' },
        description: 'At least 1 honest caveat about data limitations for this firm.',
      },
    },
    required: [
      'positioning_summary',
      'alts_readiness_bullets',
      'current_alts_footprint',
      'suggested_angle',
      'conversation_starters',
      'caveats',
    ],
    additionalProperties: false,
  },
}

const PROMPT_RULES = `You are writing a pre-meeting brief for an alternatives-distribution salesperson preparing to meet this RIA.

HARD RULES:
1. Use ONLY facts present in the FIRM DATA below. Every dollar figure and percentage you write must appear verbatim in the data.
2. Do NOT compute new numbers — no averages, per-client figures, ratios, or differences that are not already written in the data. If you want to convey scale, quote the figures as given.
3. Do NOT invent product names, platform approval statuses, clearing arrangements, or any firm-internal information.
4. Write like a sharp salesperson briefing a colleague — concrete, direct, no filler.
5. If a data point is missing, work around it; never guess a value.`

/** Rule 3 variant when KKR_NAMING=local: naming a STRUCTURE-fit vehicle is allowed, approval claims still forbidden. */
const PROMPT_RULES_KKR_LOCAL = PROMPT_RULES.replace(
  '3. Do NOT invent product names, platform approval statuses, clearing arrangements, or any firm-internal information.',
  '3. Do NOT invent platform approval statuses, clearing arrangements, or any firm-internal information. You MAY name a specific KKR vehicle per the KKR PRODUCT NAMING block below, but ONLY as a structure fit — never as an approval or existing relationship.',
)

/**
 * Resolve the prompt rules. With KKR_NAMING=local, dynamically loads the
 * gitignored config/kkr-products.local.ts and appends its naming fragment.
 * Cached after first load. Any failure falls back to the generic rules.
 */
let promptRulesCache: string | null = null
async function resolvePromptRules(): Promise<string> {
  if (promptRulesCache) return promptRulesCache
  if (process.env.KKR_NAMING === 'local') {
    try {
      const mod = await import('../../config/kkr-products.local.js')
      promptRulesCache = `${PROMPT_RULES_KKR_LOCAL}\n${mod.KKR_NAMING_PROMPT}`
      console.log('  ⚙ KKR_NAMING=local — product naming override active (local-only)')
      return promptRulesCache
    } catch (err) {
      console.warn(`  ⚠ KKR_NAMING=local set but local config not loaded (${(err as Error).message}) — using generic rules`)
    }
  }
  promptRulesCache = PROMPT_RULES
  return promptRulesCache
}

let client: Anthropic | null = null

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Generate one grounded brief via a forced, strict tool call.
 * Returns null on any failure — the caller renders a data-only skeleton instead.
 */
export async function generateBrief(firmContext: string): Promise<FirmBrief | null> {
  try {
    client ??= new Anthropic()
    const promptRules = await resolvePromptRules()
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [BRIEF_TOOL],
      tool_choice: { type: 'tool', name: 'submit_brief' },
      messages: [{ role: 'user', content: `${promptRules}\n\n=== FIRM DATA ===\n${firmContext}` }],
    })
    const toolUse = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_brief',
    )
    if (!toolUse) return null
    const parsed = FirmBriefSchema.safeParse(toolUse.input)
    return parsed.success ? parsed.data : null
  } catch (err) {
    console.warn(`  ⚠ brief generation failed: ${(err as Error).message}`)
    return null
  }
}
