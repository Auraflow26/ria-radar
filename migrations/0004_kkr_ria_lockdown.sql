-- [KKR-RIA] Lock the demo to read-only at the RLS layer before public deploy.
--
-- The web app ships a publishable (anon) key in the browser bundle. Vercel
-- Password Protection guards the site, NOT the Supabase REST endpoint — so any
-- holder of the anon key could otherwise hit PostgREST directly. We drop every
-- non-SELECT policy. The pipeline writes with the SERVICE-ROLE key, which
-- BYPASSES RLS entirely, so ingest/score/enrich/briefs/persist are unaffected.
--
-- Result: anon can SELECT only. No anon INSERT/UPDATE/DELETE on any table.

-- firms/briefs: these "write" policies were already service-role-gated (anon
-- blocked), but drop them so the tables are unambiguously read-only for anon.
drop policy if exists "kkr_ria_firms write"  on public.kkr_ria_firms;
drop policy if exists "kkr_ria_briefs write" on public.kkr_ria_briefs;

-- outcomes: this was the real anon-write hole (insert with_check = true).
-- Drop the anon insert + the redundant service-role admin policy.
drop policy if exists "kkr_ria_outcomes insert" on public.kkr_ria_outcomes;
drop policy if exists "kkr_ria_outcomes admin"  on public.kkr_ria_outcomes;

-- SELECT policies remain on all three tables. Service-role bypasses RLS for writes.
