-- [KKR-RIA] Allow anonymous READ on the RIA tables for the web UI.
-- These hold only public SEC Form ADV data + grounded briefs derived from it —
-- safe for public read. Writes stay service-role-only (policies in 0001).
-- The web app uses the anon/publishable key; no auth required for the read view.

create policy "kkr_ria_firms anon read"  on public.kkr_ria_firms  for select using (true);
create policy "kkr_ria_briefs anon read" on public.kkr_ria_briefs for select using (true);
