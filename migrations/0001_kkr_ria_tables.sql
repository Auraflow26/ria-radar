-- [KKR-RIA] RIA Radar persistence — auraflow-style structured results tables.
-- Mirrors the diagnostic_results pattern: one row per scored entity, JSONB for
-- the explainable component breakdown, RLS on, upsert by natural key (CRD).
--
-- Apply with: supabase migration up  (or the Supabase MCP apply_migration tool).
-- NOT auto-applied by the pipeline — persistence is opt-in via SUPABASE_* env.

-- ── ranked firms ────────────────────────────────────────────────────────────
create table if not exists public.kkr_ria_firms (
  id               uuid primary key default gen_random_uuid(),
  crd              integer not null unique,                 -- natural key (SEC CRD)
  run_snapshot     text    not null,                        -- ADV roster month, e.g. '2026-06'
  rank             integer not null,
  score            numeric(5,2) not null,                   -- 0–100 composite
  data_completeness numeric(4,3) not null,                  -- share of weight with data
  name             text    not null,
  city             text,
  state            text,
  website          text,
  raum_total       bigint,
  raum_discretionary bigint,
  raum_hnw         bigint,
  employees        integer,
  private_fund_count integer,
  filing_date      date,
  components       jsonb   not null default '[]'::jsonb,     -- per-signal score+evidence
  enrichment       jsonb,                                   -- custodians, fund detail, web hits
  updated_at       timestamptz not null default now()
);

comment on table public.kkr_ria_firms is '[KKR-RIA] Ranked RIA call list — one row per firm, scored on public ADV signals.';
create index if not exists kkr_ria_firms_rank_idx on public.kkr_ria_firms (run_snapshot, rank);
create index if not exists kkr_ria_firms_score_idx on public.kkr_ria_firms (score desc);

-- ── generated briefs ────────────────────────────────────────────────────────
create table if not exists public.kkr_ria_briefs (
  id               uuid primary key default gen_random_uuid(),
  crd              integer not null unique references public.kkr_ria_firms (crd) on delete cascade,
  rank             integer not null,
  model            text    not null,                        -- e.g. 'claude-opus-4-8' or 'skeleton'
  grounded         boolean not null default true,           -- passed the grounding gate
  brief            jsonb   not null,                         -- the FirmBrief structured output
  source_context   text    not null,                         -- the grounded context the gate checks against
  updated_at       timestamptz not null default now()
);

comment on table public.kkr_ria_briefs is '[KKR-RIA] Pre-meeting briefs — structured FirmBrief + the source context the grounding gate validates.';

-- ── RLS: multi-tenant isolation, service-role writes only ───────────────────
alter table public.kkr_ria_firms  enable row level security;
alter table public.kkr_ria_briefs enable row level security;

-- read: any authenticated member of the KKR-RIA workspace
create policy "kkr_ria_firms read"  on public.kkr_ria_firms  for select using (auth.role() = 'authenticated');
create policy "kkr_ria_briefs read" on public.kkr_ria_briefs for select using (auth.role() = 'authenticated');

-- write: service role only (the pipeline runs with the service key, never the client)
create policy "kkr_ria_firms write"  on public.kkr_ria_firms  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "kkr_ria_briefs write" on public.kkr_ria_briefs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
