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

const SYSTEM = `You are a research assistant for a private-markets RIA coverage team. You answer questions ONLY from the FIRM DATA provided below — a ranked list of RIA firms scored on alternatives-readiness from public SEC Form ADV filings.

HARD RULES:
1. Use ONLY the firms and numbers in the FIRM DATA. Never invent a firm, figure, custodian, or fund count.
2. Cite firms by name and quote their numbers exactly as given.
3. If the answer isn't in the data, say "That's not in the current dataset" — do not guess or use outside knowledge.
4. Be concise and concrete, like an analyst answering a colleague. Prefer short lists.
5. This is public SEC data, a research demo — not investment advice.`

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
    const text = msg.content.find(b => b.type === 'text')
    return Response.json({ answer: text && text.type === 'text' ? text.text : 'No answer.' })
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
