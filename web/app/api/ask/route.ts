import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Grounded query assistant. Answers ONLY from the published firm list + briefs in
// Supabase. Same discipline as the brief gate: cite real firms/numbers, and when
// the answer isn't in the data, say so — never invent.

const MODEL = process.env.CHAT_MODEL || 'claude-sonnet-4-6'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
)

const SYSTEM = `You are the guide for RIA Radar — a tool that ranks US wealth-channel RIA firms on alternatives-readiness from public SEC Form ADV filings, for a private-markets coverage team. You do two things: (A) answer questions about the firm data, and (B) explain how the tool works and help the user navigate it.

HOW THE TOOL WORKS (use this to guide users):
- The funnel: ~16,900 SEC filings → ~2,000 in-scope wealth-channel firms → all scored → top 75 enriched with the live ADV PDF (custodians, Schedule D 7.B fund detail) + a homepage scan → top firms get a one-page grounded brief. The published list shows the top 150.
- The score (0–100) is DETERMINISTIC — eight weighted signals from the ADV: existing private-fund exposure, HNW client mix (the two heaviest), AUM scale, custodian platform access, discretionary ratio, website alts language, AUM growth, and a coverage-feedback signal from logged call outcomes. Weights renormalize over whatever a firm reports, so missing data lowers confidence, never invents a penalty.
- Desk lenses: the list re-ranks instantly by coverage thesis — Balanced (house view), Private credit desk (alts machinery + custody), Private equity desk (HNW + scale), Real estate/income desk (HNW + discretionary). Same universe, different priorities. Tell users to use the "Rank for" buttons at the top of the list.
- Briefs: the top 75 firms have a pre-meeting brief (positioning, why-alts-ready, current footprint, suggested angle, conversation starters). Every number in a brief is checked against the source filing by a grounding gate — if it doesn't trace, the brief is rejected. That's why the briefs are client-safe.
- Pages: "Ranked list" (home, with lenses + filters), each firm's detail page (brief + score breakdown + "view source data"), "How I'd work it" (analyst memo), "Methodology".

HARD RULES:
1. For DATA questions, use ONLY the firms and numbers in the FIRM DATA below. Never invent a firm, figure, custodian, or fund count. Cite firms by name and quote numbers exactly.
2. If a data answer isn't in the dataset, say "That's not in the current dataset."
3. For HOW-IT-WORKS questions, explain from the description above. You may help users navigate ("use the Private credit desk lens at the top", "open the firm's page for its brief").
4. Be concise and concrete, like an analyst helping a colleague. Short lists, point to the right page.
5. Public SEC data, research demo — not investment advice.

ACTIONS: when the user asks to FILTER or SHOW a subset of the list (by state, AUM, fund count, custodian keyword, or desk lens), end your reply with ONE directive line in this exact form so the app can apply it:
[[APPLY state=TX minAum=10 minFunds=5 q=schwab lens=credit]]
Include only the keys that apply. state = 2-letter code. minAum in $B (integer). minFunds = integer. q = a single search keyword. lens = one of balanced|credit|pe|realestate. Put the directive on its own final line; still give a short text answer above it. Omit the directive entirely for pure questions.`

interface FirmRow {
  rank: number; name: string; city: string | null; state: string | null
  score: number; raum_total: number | null; private_fund_count: number | null
  enrichment: { custodians?: { name: string }[]; structureHits?: string[] } | null
}

const fmtB = (n: number | null) => (n === null ? 'n/a' : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`)

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'chat not configured' }, { status: 503 })
  }
  let question = ''
  try {
    ;({ question } = await req.json())
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  if (!question || question.length > 500) {
    return Response.json({ error: 'question required (max 500 chars)' }, { status: 400 })
  }

  const { data } = await sb
    .from('kkr_ria_firms')
    .select('rank,name,city,state,score,raum_total,private_fund_count,enrichment')
    .order('rank', { ascending: true })
    .limit(150)

  const firms = (data ?? []) as FirmRow[]
  const context = firms
    .map(f => {
      const cust = f.enrichment?.custodians?.map(c => c.name).join('/') ?? '—'
      const web = f.enrichment?.structureHits?.length ? ` web:${f.enrichment.structureHits.join(',')}` : ''
      return `#${f.rank} ${f.name} (${[f.city, f.state].filter(Boolean).join(', ')}) score ${Math.round(f.score)} RAUM ${fmtB(f.raum_total)} funds ${f.private_fund_count ?? 'n/a'} custodian ${cust}${web}`
    })
    .join('\n')

  const client = new Anthropic()
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: `=== FIRM DATA (${firms.length} firms) ===\n${context}\n\n=== QUESTION ===\n${question}` }],
    })
    const block = msg.content.find(b => b.type === 'text')
    let answer = block && block.type === 'text' ? block.text : 'No answer.'

    // Parse an optional [[APPLY ...]] directive into a filter action + strip it from the text.
    let action: Record<string, string> | null = null
    const m = answer.match(/\[\[APPLY([^\]]*)\]\]/i)
    if (m) {
      answer = answer.replace(m[0], '').trim()
      const allowed = new Set(['state', 'minAum', 'minFunds', 'q', 'lens'])
      const params: Record<string, string> = {}
      for (const kv of m[1].trim().split(/\s+/)) {
        const [k, v] = kv.split('=')
        if (k && v && allowed.has(k)) params[k] = v
      }
      if (Object.keys(params).length) action = params
    }
    return Response.json({ answer, action })
  } catch (e) {
    // Don't leak raw provider errors (billing, etc.) to the UI.
    const raw = (e as Error).message
    const friendly = /credit balance|quota|rate limit/i.test(raw)
      ? 'The assistant is temporarily unavailable. Please try again later.'
      : 'Could not generate an answer right now.'
    console.error('ask error:', raw)
    return Response.json({ error: friendly }, { status: 503 })
  }
}
