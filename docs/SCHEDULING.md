# RIA Radar — Scheduled refresh (KKR RIA Project)

Production roadmap step 4. `.github/workflows/pipeline.yml` runs the full pipeline
on a quarterly cron and on demand, persisting fresh ranks + briefs to Supabase.

## What runs

`ingest → score → enrich (top-N) → briefs (top-10) → persist → validate`

- **Cron:** 06:00 UTC on the 1st of Jan/Apr/Jul/Oct (after the month-end ADV roster posts).
- **Manual:** Actions tab → "RIA Radar pipeline" → Run workflow. Inputs: `top` (enrich/brief depth), `with_bulk` (slow SEC structured bulk).
- **Hard gate:** the validation step fails the workflow if any brief figure doesn't trace to source. A red run does not silently ship.
- **Artifacts:** ranked CSV/HTML + briefs uploaded (30-day retention).

## One-time setup

The job needs every pipeline secret. Rather than 4+ GitHub secrets, it uses a
single **Doppler service token** that injects them all at runtime.

1. In Doppler (`auraflow-platform` → `dev`, or a dedicated `prd` config):
   Access → Service Tokens → generate a **read-only** token.
2. In GitHub: repo → Settings → Secrets and variables → Actions → New secret:
   - Name: `DOPPLER_TOKEN`
   - Value: the service token
3. Confirm the config has: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

That's it — the workflow does `doppler run -- …` and the keys are present.

## Notes

- Concurrency is serialized (`cancel-in-progress: false`) so two runs never write Supabase at once.
- `enrich` re-runs `score` internally, which re-persists firms before briefs persist (FK order).
- To change cadence, edit the `cron` line. To deepen a run, bump `top`.
