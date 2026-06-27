# RIA Radar — Production Tech Stack Breakdown

From the 2-day demo to a system a private-markets RIA coverage team could run on.
What exists, what needs building, and the tech choice for each layer.

> Public data only. Research demo, not investment advice. Any client-internal
> product naming stays out of this repo (gitignored locally for a reason).

---

## Where it is today (the demo)

A single-machine TypeScript/Node CLI: pulls public SEC data → deterministic
scoring → Claude writes briefs through a forced schema → grounding gate → static
HTML/CSV files. No server, no database (on `main`), no UI. The feature branch
already adds Supabase persistence, Apify web-rendering, and agentic enrichment —
built, partially live-run (ingest+score verified on live June-2026 ADV data).

The demo proves the method. Production is about **freshness, depth, scale,
delivery, and trust** — not rewriting the core.

---

## The stack, layer by layer

### 1. Data ingestion
- **Today:** monthly SEC ADV roster (CSV) + per-firm ADV PDFs + homepage fetch, cached to disk.
- **To build:** full Schedule D parsing (every fund, every custodian, structured); quarterly/continuous scheduled ingestion; harden the `--with-bulk` parser (heuristic, unverified inner schema).
- **Tech:** Node workers + `csv-parse` / `pdf-parse` (in use); add a scheduler.

### 2. Storage / data model
- **Today:** filesystem cache + Supabase tables on the branch (`kkr_ria_firms`, `kkr_ria_briefs`, RLS, CRD natural-key upsert) — tables live in prod.
- **To build:** promote Supabase to system of record (firms, scores, briefs, fund detail, custodians, historical snapshots); canonical schema so every consumer reads one shape; versioned score history per firm.
- **Tech:** Supabase Postgres (`bfzdcyuyilesubtgbhdc`), pgvector if semantic firm-matching is added, RLS for access.

### 3. Enrichment
- **Today:** homepage scrape + agentic action-planner (Opus picks what to fetch) + Apify fallback for JS-rendered sites — env-gated.
- **To build:** Apify rendering always-on + reliable (token + proxy); expand signals (competitor-shelf, vehicle-structure language, news/filings deltas); cache + dedupe so unchanged sites aren't re-fetched.
- **Tech:** Apify website-content-crawler (wired) + existing rate-limiter; Opus planner via Anthropic SDK.

### 4. Scoring engine
- **Today:** deterministic TypeScript, 7 weighted signals, weights renormalize over available data. **Do NOT replace.**
- **To build:** configurable weights per use case; feedback loop (call outcomes re-weight signals); expose per-signal breakdown via API.
- **Tech:** keep pure TypeScript (auditability is the selling point); store weight configs + outcomes in Supabase.

### 5. AI / brief generation
- **Today:** Claude via forced tool-call + Zod schema. Prose only, never numbers. Opus 4.8 on the branch.
- **To build:** lock model + prompt as versioned config (reproducible output); batch generation for full top-N with retries + cost tracking.
- **Tech:** Anthropic SDK (bump the `^0.39.0` pin), forced-schema pattern unchanged.

### 6. Validation / trust gate
- **Today:** grounding gate extracts every $/% and fails the build if it doesn't trace to source. 12/12 passing.
- **To build:** run the gate every brief/every run + log results; coverage dashboards (ingest counts, RAUM coverage, custodian extraction rate).
- **Tech:** existing validation module + a results table in Supabase + a status view.

### 7. Orchestration / scheduling
- **Today:** manual `npx tsx scripts/run.ts`, stage-by-stage.
- **To build:** scheduled, resumable runs (ingest → score → enrich → briefs → persist); per-stage retries + failure isolation (a bad PDF can't kill the run).
- **Tech:** start simple — GitHub Actions or a cron worker on Fly.io; graduate to Temporal Cloud (already in the AuraFlow stack) if runs get complex.

### 8. Delivery / interface
- **Today:** static HTML files opened locally. **Biggest gap for a real user.**
- **To build:** lightweight web app (searchable ranked list, filters by AUM/custodian/geo, click-through briefs, export); CRM sync (Salesforce/Dynamics); branch-office geo-matching to wholesaler territories.
- **Tech:** Next.js on Vercel (mirrors AuraFlow's PWA), reading from Supabase; CRM via API.

### 9. Security / access / compliance
- **Today:** local, single-user, public data only.
- **To build:** auth + role-based access (RLS is the foundation); audit logging (SHA-256 hash-chained, as AuraFlow already does); secrets management; keep the public-data-only boundary enforced + documented.
- **Tech:** Supabase Auth + RLS, Doppler for secrets, audit-log table.

### 10. Observability / cost
- **Today:** console logs.
- **To build:** run history, error tracking, LLM cost per run, freshness/coverage metrics.
- **Tech:** Fly.io metrics or Grafana Cloud free tier, plus a cost-per-run line item.

---

## Build sequence (smallest viable → full)

1. **Make the live run work** — set the 3 API keys, run the full pipeline once, persist to Supabase. *Only thing blocking real output today.*
2. **Lock storage as system of record** — Supabase schema + historical snapshots.
3. **Ship a thin web UI** — searchable list + briefs from Supabase. Biggest perceived leap for a user.
4. **Schedule it** — automated quarterly/monthly refresh.
5. **Feedback loop + CRM sync** — makes it sticky for a coverage team.

---

## What's honest

- **The hard part is done:** method, scoring, grounding gate, and data plumbing exist and are proven on real public filings.
- **What's left is productization, not invention:** persistence, UI, scheduling, CRM delivery — known engineering, not research risk.
- **Reuses a working platform:** Supabase, Fly.io, Vercel, Temporal, Doppler already run in production for AuraFlow — not greenfield infra.
