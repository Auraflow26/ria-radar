-- [KKR-RIA] Feedback loop — capture call outcomes per firm.
-- Outcomes feed back into scoring: firms whose profile yields good outcomes get
-- a small, capped, deterministic nudge. The signal is OUR data, no external dep.

create table if not exists public.kkr_ria_outcomes (
  id          uuid primary key default gen_random_uuid(),
  crd         integer not null references public.kkr_ria_firms (crd) on delete cascade,
  outcome     text    not null check (outcome in ('meeting','won','no_answer','lost','not_a_fit')),
  notes       text,
  created_at  timestamptz not null default now()
);

comment on table public.kkr_ria_outcomes is '[KKR-RIA] Call outcomes per firm — feeds the scoring feedback loop.';
create index if not exists kkr_ria_outcomes_crd_idx on public.kkr_ria_outcomes (crd);

alter table public.kkr_ria_outcomes enable row level security;

-- read: anyone (public-data demo); write: anon insert allowed so the demo UI can log.
create policy "kkr_ria_outcomes read"  on public.kkr_ria_outcomes for select using (true);
create policy "kkr_ria_outcomes insert" on public.kkr_ria_outcomes for insert with check (true);
-- service role keeps full control for the pipeline.
create policy "kkr_ria_outcomes admin" on public.kkr_ria_outcomes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
