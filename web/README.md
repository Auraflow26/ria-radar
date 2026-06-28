# RIA Radar — Web UI (KKR RIA Project)

Next.js (App Router) front end for the RIA Radar pipeline. Reads the ranked call
list + grounded briefs from Supabase (`kkr_ria_firms`, `kkr_ria_briefs`) and
renders a searchable/filterable list, per-firm briefs, and the "why this rank"
score breakdown. AuraFlow brand kit (dark, purple accent, mono for data).

## Run

```bash
cd web
cp .env.example .env.local   # fill the publishable key
npm install
npm run dev                  # http://localhost:3000
```

## Deploy (Vercel)

- Root directory: `web`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Framework preset: Next.js (zero config)

## Data & access

- Read-only. Uses the Supabase **publishable** key; RLS allows anon `SELECT` on
  `kkr_ria_*` (public SEC Form ADV data) and nothing else. Writes stay
  service-role-only (the pipeline). See `../migrations/0002_kkr_ria_anon_read.sql`.
- Pages revalidate from the DB every 5 minutes.

Public SEC data — research demo, not investment advice.
