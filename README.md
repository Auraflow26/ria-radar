# RIA Radar

**From 15,000+ SEC Form ADV filings to a ranked RIA call list and meeting-ready briefs — in one command.**

```
npx tsx scripts/run.ts
```

Built as a working answer to a distribution problem: a private-markets wealth team covering the RIA channel faces ~17,000 SEC-registered advisers and a finite number of wholesalers. The question isn't *who are the RIAs* — vendors sell that list. It's **who do you call first, and what do you say when they pick up.**

RIA Radar answers both, using only public data.

## What it produces

1. **A ranked call list** (`output/ranked-rias.html` / `.csv`) — every US wealth-channel RIA scored 0–100 on alts-readiness, with the full per-component evidence one click away. *"Why is this firm #3?"* answers itself.
2. **Pre-meeting briefs** (`output/briefs/`) — a one-page HTML brief per top firm: ADV snapshot tiles, why-they're-ready bullets (every figure cited from the filing), current alternatives footprint, suggested conversation angle, and three discovery questions. Print to PDF, walk into the meeting.

A committed sample run lives in [`output/sample/`](output/sample/).

## How it works

```
SEC monthly ADV roster (16,876 firms, ~450 columns)
        │  stage 1 — ingest: parse, type, filter to wealth-channel firms
        ▼
3,800+ in-scope firms
        │  stage 2 — score: 7 weighted public signals → ranked list
        ▼
Top 75 candidates
        │  stage 3 — enrich: full ADV PDF (custodians) + homepage scan
        │            (alts vehicle structures, competitor shelf traces)
        ▼
Re-ranked top list
        │  stage 4 — briefs: Claude writes prose grounded ONLY in the
        │            firm's own data; a validation gate rejects any
        │            dollar figure that doesn't trace to the source
        ▼
output/ranked-rias.{csv,html} + output/briefs/*.html
```

## The scoring model

Deterministic and fully decomposable — **the LLM writes prose, never numbers.** Weights renormalize over available signals, so missing data lowers confidence instead of silently penalizing a firm.

| # | Signal | Source | Weight | Rationale |
|---|--------|--------|:------:|-----------|
| 1 | Existing private-fund / alts exposure | ADV Item 7.B + fund-type counts | 25 | Firms already running private vehicles have done the operational and diligence work — shortest path to a first allocation. |
| 2 | High-net-worth client mix | Item 5.D(b)(3) ÷ 5.F(2)(c) | 30 | Evergreen and semi-liquid products need qualified HNW books. |
| 3 | AUM scale | Item 5.F(2)(c) | 15 | Distribution targets scale with shelf space — a $20B aggregator rolling out a model allocation moves more than a hundred small firms. |
| 4 | Discretionary ratio | Item 5.F(2)(a) ÷ 5.F(2)(c) | 10 | A discretionary book can implement a model allocation across hundreds of households at once. |
| 5 | Custodian platform access | Schedule D 5.K(3), per-firm ADV PDF | 10 | Custody at the major platforms means the operational rails for alt-product distribution already exist. |
| 6 | AUM growth | Month-over-month roster snapshots | 5 | Growth correlates with openness to new shelf space. |
| 7 | Website alts language | Homepage scan: vehicle structures + competitor traces | 5 | A competitor on the shelf is a *buy* signal — the firm has already done alts onboarding. |

Hard disqualifiers (listed with reasons in `output/excluded.csv`): pooled-vehicle assets above 50% of the book (a manufacturer, not a distributor), inactive registration, non-US main office.

## Quickstart

```bash
npm install
cp .env.example .env        # ANTHROPIC_API_KEY — needed only for stage 4
npx tsx scripts/run.ts      # full pipeline
```

Stages 1–3 need **no API key**. Without one, stage 4 still renders grounded data-only briefs.

```bash
npx tsx scripts/run.ts --stage ingest,score     # just the ranked list
npx tsx scripts/run.ts --stage briefs --top 5   # top-5 briefs
npx tsx scripts/run.ts --offline                # cache only, no network
npx tsx scripts/validate.ts                     # quality gates
```

Everything downloads to `data/` on first run (~10MB of zips); after that the whole pipeline re-runs offline.

## Keeping the model honest

- **Grounding gate** — the validate stage extracts every dollar figure from every brief and fails the build if one doesn't appear verbatim in that firm's source context. Hallucinated numbers don't survive to the meeting.
- **Coverage gates** — ingest row counts, RAUM coverage, prior-month CRD overlap, score-distribution sanity, custodian extraction rate.
- **Caveats by design** — every brief footer states the data's limits: self-reported regulatory AUM, filing and fetch dates.

## Data sources & compliance notes

- [SEC monthly Investment Adviser roster](https://www.sec.gov/data-research/sec-markets-data/information-about-registered-investment-advisers-exempt-reporting-advisers) (public bulk CSV)
- Per-firm full ADV PDFs and firm summaries via [adviserinfo.sec.gov](https://adviserinfo.sec.gov) (public)
- Firm homepages (public)

All requests carry a descriptive User-Agent and run at 2 req/s per SEC fair-access guidance. Everything here is public data; AUM is self-reported regulatory AUM. This is a research demo, **not investment advice**, and it makes no claims about any manager's products, platform approvals, or internal data.

## KKR RIA Project — platform extensions

Tagged `[KKR-RIA]` in code. These layers make the demo a repeatable, persisted run using AuraFlow's data/agentic/schema techniques. All are **opt-in via env** — unset, the pipeline runs exactly as the file-only demo above.

- **Supabase persistence** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Ranked firms → `kkr_ria_firms`, briefs → `kkr_ria_briefs`. JSONB for the explainable component breakdown, natural-key (CRD) upsert, RLS on (authenticated read, service-role write). Migration: [`migrations/0001_kkr_ria_tables.sql`](migrations/0001_kkr_ria_tables.sql). Zero new dependency — talks to PostgREST via `fetch`.
- **Agentic enrichment** (`KKR_AGENTIC_ENRICH=1`). Per firm, an Opus tool-use agent (forced `tool_choice` + strict schema, same discipline as the brief writer) decides *which* enrichment actions to run — it chooses actions only, never produces firm data. Deterministic fetchers still do the work and the grounding gate still validates every number. Off → the original fixed fetch path.
- **Model**: KKR-facing briefs run on `claude-opus-4-8` (most capable), inside the unchanged forced-schema + grounding guardrails.
- **Apify JS-render fallback** + **Schedule D 7.B fund detail** + **`--with-bulk` breadth** — fresher, deeper, grounded signals (see `.env.example`).

The credibility moat is unchanged: the LLM is the least-trusted component. It chooses actions and writes prose; the math, the schema, and the grounding gate do everything that matters.

## What production would look like

This is a two-day demo. The production version adds: full Schedule D ingestion (every private fund, every custodian, structured), quarterly time series instead of month-over-month snapshots, CRM sync so coverage teams consume ranks where they work, branch-office geo-matching to wholesaler territories, and a feedback loop where call outcomes re-weight the scoring model.

## License

MIT. Built by [Mo Talebi](mailto:mo@auraflowusa.com).
