# Refreshing RIA Radar

SEC monthly Form ADV rosters provide assets, client mix and other reported financial fields. The pipeline discovers the two latest consecutive rosters on the SEC's published index; it does not guess ZIP filenames. These are the latest available filings, not live balances. Scores remain rule-based weighted scores, not predictions trained on KKR sales history.

For the top selected firms, the pipeline downloads ADV PDFs and fetches homepages normally. If a homepage is an empty JavaScript shell, Apify's `website-content-crawler` renders that one homepage with a browser. Apify does not supply AUM or calculate scores. Saved receipts include the URL, acquisition time, run ID and dataset ID. Undated, stale (30 days) or differently addressed cache entries are refreshed. Failed reads remain unknown and do not become negative evidence. Unknown components are still omitted from the weighted average; compare data completeness alongside score.

An actor starts asynchronously and its ID is saved before polling. If polling is interrupted, the next run resumes that ID instead of starting another paid run. Each fallback has a `maxTotalChargeUsd` cap (default $0.25). This cap is not a guarantee that every website can be read.

## Prepare an update without database writes

```sh
npm ci
npm test
npm run typecheck
npm run pipeline -- --stage ingest,score
npm run pipeline -- --stage enrich --top 75 --refresh
npm run pipeline -- --stage briefs --top 75
npm run validate
npm run publish
```

The last command creates `data/refresh-artifact.json`; it does not publish. Briefs without an Anthropic key use data-only templates. Figure checks preserve units, so $1.2M does not verify $1.2B. This checks numeric traceability, not every sentence's meaning.

## Reviewed publication

1. Verify that `SUPABASE_URL` and the service key belong to the RIA Radar database. Do not copy another application's service key simply because it is available in Doppler.
2. Review and apply `migrations/0006_atomic_refresh.sql` to that database through its migration process. The runner never applies migrations. Rehearse its down file before applying.
3. Deploy the matching UI code after the migration. Older briefs without a matching generation are hidden rather than presented beside new scores.
4. Publish the validated artifact with `npm run publish -- --apply`. This calls a service-role-only RPC: retire the previous visible list, publish the new top 150 and matching briefs together, and retain historical firms/outcomes. Any failed write rolls the entire publication back.
5. Read back the generation, 150 visible firms and matching briefs; check the home, firm detail and mobile views. Only this verifies the live release.

Rollback: revert the application before the down migration. Dropping the new columns does not restore previous published data; retain the prior artifact for a deliberate data restoration. No automatic rollback or deletion is performed.

## Credentials and schedule

Use a RIA-scoped Doppler configuration and a read-only service token stored as GitHub Actions secret `DOPPLER_TOKEN`. Names: `APIFY_TOKEN`, `APIFY_MAX_CHARGE_USD`, optional `ANTHROPIC_API_KEY`; publication additionally needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put server secrets in `NEXT_PUBLIC_*` variables. The existing Vercel public database key remains read-only.

The workflow prepares monthly artifacts on day 7 and supports manual runs. It intentionally does not publish or send watchlist alerts until the migration and release are reviewed. A missing Doppler token fails explicitly. Repository credentials were missing during this audit, so scheduling alone does not make the live data current.
