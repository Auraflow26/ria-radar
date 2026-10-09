# Refresh audit — 2026-10-09

Base: `cbe1642e5e96424396fe3c64da4238e2328008e3` on Auraflow26/ria-radar. Read-only discovery found no competing open PRs. Admission: EXTEND the existing ingestion, enrichment, scoring, brief and database homes.

## What was broken

- SEC sources stayed pinned to June/May while October/September files were available.
- Undated/indefinite website and PDF caches could keep old evidence in new scores. Apify text had no reliable run receipt.
- Scheduled GitHub runs failed because no Doppler service token was configured.
- Briefs were persisted before validation; numeric checks lost million/billion units and skipped missing source contexts.
- CRD upserts retained old ranked firms and mismatched briefs; no complete publication generation existed.

## What changed

Discover real SEC links; expire caches after 30 days; record acquisition dates and actual Apify run/dataset IDs; resume saved actor runs; require current evidence to score enrichment. Scores remain the existing deterministic weighted model. Unknown components remain excluded from the average, so completeness must be considered separately.

Generate local results first, validate units/source figures, and prepare an artifact. The explicit publisher uses one database transaction, preserves historical records/outcomes, and exposes only the current top 150. The UI uses matching generations and displays the source month; mobile navigation wraps and invalid custom weights are ignored.

## Evidence

The real October roster has 17,210 advisers, 2,241 size/retail candidates and 2,021 ranked firms. The first top-75 pass downloaded 75 PDFs and read 64 usable websites, including 10 actual bounded Apify runs. After the second pass, the final top 75 have 73 current PDF reads and 61 usable homepage reads; the remaining signals are unknown. Failed reads remain unknown. These are public filings and website signals, not KKR historical/current sales data or live adviser balances.

41 local refresh checks pass and cover source discovery, cache expiry, units, unknowns, Apify receipts/retry, anonymous publication refusal, transactional publication rollback, and migration down/reapply. Negative controls deliberately remove unit preservation and cache expiry; each causes its corresponding test to fail.

Root typecheck and Next.js production build pass. Browser checks against the refreshed artifact through a local read-only HTTP database fixture verify 150 firms, search, no-result state, lenses, eight sliders, called filter, firm brief, four navigation pages, chat error handling and zero uncaught browser errors. At 390px mobile width, document width is also 390px. This fixture is not a production database test.

## Release limits

No migration applied, no production rows published, no merge or production deployment. GitHub refresh CI passes. Automatic Vercel preview failed before compiling: its project Root Directory is `.` instead of `web`, so it cannot detect Next.js. The project setting remains unchanged; correct it at release. The live dashboard remains on its prior data. Publishing needs the reviewed migration/UI release and a service key verified to belong to the RIA database. GitHub still needs a RIA-scoped Doppler service token. The monthly workflow prepares artifacts only until publication is enabled deliberately.

Data-only template briefs were used in this run; no Anthropic generation charge. All public-source downloads and Apify fallbacks were real. Apify caps were $0.25 per actor, not a measured total bill. Raw downloads, run receipts, ranked CSV/JSON, browser screenshots and test logs are retained locally under `/Users/motalebi/Downloads/ria-radar-audit-2026-10-09/`.
