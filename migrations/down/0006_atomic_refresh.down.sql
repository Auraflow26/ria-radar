-- Roll back the UI/publisher code first. Does not restore previous data values.
drop function if exists public.publish_kkr_ria_refresh(text,jsonb,jsonb);
alter table public.kkr_ria_briefs drop column if exists run_snapshot;
alter table public.kkr_ria_firms drop column if exists is_current;
