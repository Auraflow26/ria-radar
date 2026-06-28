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

- **Root directory:** `web` (set in Vercel project settings — the repo root is the pipeline, not the app)
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key — safe in browser)
- **Framework preset:** Next.js (zero config; `vercel.json` pins it)
- **Before sharing externally:** turn on **Deployment Protection → Password Protection** (Vercel project → Settings → Deployment Protection). The link reads live prod data, so gate it before forwarding.
- The publishable key is anon-scoped (RLS = read-only on `kkr_ria_*`); rotating the Supabase service-role key does NOT change it.

## Data & access

- Read-only. Uses the Supabase **publishable** key; RLS allows anon `SELECT` on
  `kkr_ria_*` (public SEC Form ADV data) and nothing else. Writes stay
  service-role-only (the pipeline). See `../migrations/0002_kkr_ria_anon_read.sql`.
- Pages revalidate from the DB every 5 minutes.

Public SEC data — research demo, not investment advice.
