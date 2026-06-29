-- [KKR-RIA] Watchlist / ADV-change alerts (#1).
-- A snapshot of the values we diff against, and the alerts produced when a firm's
-- next ADV filing crosses a trigger (RAUM jump, new fund, custodian change, new
-- filing). All public SEC data. scripts/watch.ts writes both; the web /watch
-- page reads alerts. Anon read only (RLS); service-role writes.

create table if not exists public.kkr_ria_snapshots (
  crd            integer primary key,
  raum_total     bigint,
  private_fund_count integer,
  custodians     text,          -- sorted comma-joined names at snapshot time
  filing_date    date,
  captured_at    timestamptz not null default now()
);

create table if not exists public.kkr_ria_alerts (
  id          uuid primary key default gen_random_uuid(),
  crd         integer not null,
  name        text   not null,
  kind        text   not null check (kind in ('raum_jump','new_fund','custodian_change','new_filing')),
  detail      text   not null,
  created_at  timestamptz not null default now()
);

comment on table public.kkr_ria_alerts is '[KKR-RIA] ADV-change alerts for watched firms (public SEC data).';
create index if not exists kkr_ria_alerts_created_idx on public.kkr_ria_alerts (created_at desc);

alter table public.kkr_ria_snapshots enable row level security;
alter table public.kkr_ria_alerts    enable row level security;
create policy "snapshots read" on public.kkr_ria_snapshots for select using (true);
create policy "alerts read"    on public.kkr_ria_alerts    for select using (true);
