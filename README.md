# RIA Radar

**15,000+ SEC Form ADV filings → a ranked RIA call list + meeting-ready briefs. One command.**

```bash
npx tsx scripts/run.ts
```

## The problem

A private-markets wealth team covering the RIA channel has ~17,000 registered advisers and a finite number of wholesalers. Everyone already has the list. The real questions are **who do you call first** and **what do you say when they pick up**.

RIA Radar answers both, using only public data.

## What you get

- **Ranked call list** (`output/ranked-rias.html` / `.csv`) — every US wealth-channel RIA scored 0–100 on alts-readiness, with the full evidence behind each score one click away. "Why is this firm #3?" answers itself.
- **Pre-meeting briefs** (`output/briefs/`) — one page per top firm: ADV snapshot, why they're ready (every number cited to the filing), current alts footprint, suggested angle, three discovery questions. Print to PDF, walk in.

Sample run committed in `output/sample/`.

## How it works


## Scoring

Deterministic and decomposable. **The LLM writes prose, never numbers.** Missing data lowers confidence, never penalizes.

| Signal | Source | Wt | Why |
|---|---|---|---|
| HNW client mix | Item 5.D(b)(3) ÷ 5.F(2)(c) | 30 | Semi-liquid needs qualified books |
| Existing alts exposure | Item 7.B | 25 | Diligence done — shortest path to first allocation |
| AUM scale | Item 5.F(2)(c) | 15 | One $20B aggregator beats 100 small shops |
| Discretionary ratio | 5.F(2)(a) ÷ 5.F(2)(c) | 10 | Model allocation across hundreds of households at once |
| Custodian access | Schedule D 5.K(3) | 10 | Rails already exist |
| AUM growth | MoM roster snapshots | 5 | Growth = open shelf |
| Website alts language | Homepage scan | 5 | Competitor on shelf = buy signal |

**Disqualified:** pooled assets >50% of book (manufacturer, not distributor), inactive, non-US.

## Quickstart

```bash
npm install
cp .env.example .env        # ANTHROPIC_API_KEY — briefs only
npx tsx scripts/run.ts      # full run (~10MB download, then offline)
npx tsx scripts/validate.ts # quality gates
```

## Guardrails

- **Grounding gate** — every dollar figure must appear verbatim in the firm's source data or the build fails.
- **Coverage gates** — row counts, RAUM coverage, CRD overlap, score distribution, custodian extraction rate.
- Every brief footer states data limits (self-reported RAUM, filing/fetch dates).

## Data

SEC IA roster, ADV PDFs (adviserinfo.sec.gov), firm homepages. All public, 2 req/s per SEC guidance. Research demo, not investment advice.

## KKR extensions (`[KKR-RIA]`, opt-in via env)

- **Supabase persistence** — `kkr_ria_firms` / `kkr_ria_briefs`, JSONB score breakdown, CRD upsert, RLS. Migration in `migrations/`.
- **Agentic enrichment** (`KKR_AGENTIC_ENRICH=1`) — Opus agent picks which fetchers to run; it never produces firm data. Grounding gate still checks everything.
- **Model** — briefs on `claude-opus-4-8`, same forced-schema + grounding guardrails.

The LLM is the least-trusted component. Math, schema, and grounding gate do everything that matters.

## Production would add

Full Schedule D, quarterly time series, CRM sync, wholesaler territory matching, call-outcome feedback loop.

MIT. Built by Mo Talebi.
