# Prompt 09 — Data & Methodology

## Delivered behavior and routes

`/data` now has four internal tabs with one primary panel: Data Sources, Data Preview & Export, Scientific Methodology, API Usage. The four top-level routes remain `/map`, `/analysis`, `/wildfire`, `/data`. No map, complete station drawer, chart, research editor, AI or billing dashboard was added to Data.

New read-only APIs: `/api/data/catalog`, `/api/data/preview`, `/api/exports/json`, `/api/exports/csv`. The existing `/api/usage/summary` remains the measured counter source. Existing datasets/snapshot/area APIs, strict normalization and checked-in Eaton manifests supply the data. There is no new migration, applied-migration edit, provider codec or infrastructure creation. The authorized project PostgreSQL container was found stopped and started; its configuration/volumes and other project containers were not changed. Integration uses only the separately confirmed project test database.

Principal changed files:

- Contracts: `packages/contracts/src/transparency.ts`, `bff.ts`, `index.ts`.
- Server: `apps/api/src/data/workbench.ts`, `app.ts`, `server.ts`, BFF `runtime.ts`, `service.ts`, `usage.ts`, `http.ts`.
- UI: `apps/web/src/data/DataWorkbench.tsx`, `methods.ts`, `App.tsx`, `route-state.ts`, `style.css`.
- Verification: new `tests/unit/data-workbench.test.ts` and `apps/web/src/data/DataWorkbench.test.tsx`; HTTP instrumentation, DB snapshot export and Playwright tests extended. Existing page handoff expectations now reflect the working Data workspace.
- Docs: [UI contract](../frontend/data-methodology.md), [exports](../architecture/data-exports.md), [usage](../architecture/api-usage.md), data modes/provider evidence/scientific semantics, README and AGENTS.

## Source evidence and scientific scope

The catalog uses actual synthetic fixtures, the acquired EPA AirData Eaton subset, CAL FIRE/OSFM source manifests, bounded historical DB metadata and the existing client ArcGIS basemap/relief integration. AirNow is visibly contract-unverified/unavailable. A configured key is not connection evidence. No CARB feed, OpenAI data source, separate elevation API or new authenticated provider call is claimed. Source details distinguish connection, scientific status, mode, coverage, version, release, acquisition, revision and unknown fields.

Official documentation was rechecked October 27, 2026: [EPA AirData formats](https://aqs.epa.gov/aqsweb/airdata/FileFormats.html), [AirNow FAQ](https://docs.airnowapi.org/faq), [AQI basics](https://www.airnow.gov/aqi/aqi-basics/), [OSFM FHSZ](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones), [Esri API-key authentication](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/). This is documentation verification, not authenticated provider testing or scientific certification. The original [Eaton acquisition evidence](../data-sources/eaton-case-feasibility.md) remains authoritative for its artifact versions/checksums and transformations.

Seven methods sections preserve AQI/concentration, preliminary/validated/unknown, monitor/area, forecast/observation, UTC/LST/DST/date-only, FHSZ hazard and missing-data semantics. No wildfire-causation, emission-source attribution, regulatory findings, fire-risk prediction or individual exposure conclusions are introduced. Source limitations remain available in compact disclosures rather than repeating a full case screen.

## Export schema and lineage

The supported export selections are local station sample, synthetic reporting-area current AQI/forecast, file-backed Eaton observations and an explicitly identified official historical DB snapshot. All selected rows are exported (not only the visible page). Raw GIS/basemap redistribution is not offered as a numerical-observation export; their source/version references remain inspectable.

Selection is strict and reproducible: region, pollutant, distinct station/monitor or area identity, measurement kind, supported time bounds, snapshot identity. No implicit mode fallback or live acquisition. Whole-hour UTC windows have an exclusive end and stay within source coverage; literal forecast date bounds do not invent UTC midnight. A 72-hour stored snapshot is fully exported by default rather than silently truncated to the station API's default 24 hours.

Preview: at most 10 rows per page. Selection/export: at most 500 rows, 3 MB, four operations concurrently. Larger or unsafe selections fail explicitly. Preview produces a canonical record/query/source SHA-256; export requires that hash and rejects pagination or changed selections. Safe generated filenames and no-store/nosniff attachment headers are enforced.

JSON is `{manifest,data}`. CSV has a fixed header, one manifest metadata record and the selected data records. Both preserve complete discriminated native records, provider/site/POC/parameter identity, values/null/zero/negative values, unit/kind/period, timestamps, qualifiers, status and revision descriptions. CSV uses UTF-8/RFC4180/CRLF, null `\N`, formula-string hardening and lossless per-record JSON. An empty selection still has its manifest. See [full schema/encoding](../architecture/data-exports.md).

The manifest includes query, source/provider/version/release/reference/checksum, row count, acquisition/generation times, nullable verified indexing time, units/kinds/averaging/source timezone, limitations and the four Eaton source manifests when applicable. Unknown version/release/indexing is not fabricated. Historical AQS row certification remains unknown. Full 71-row EPA export and persisted DB replay were verified.

## Actual measured usage

The HTTP wrapper now counts immediately before each actual fetch/send and completes each outcome once. `requests = successes + failures + inFlight`; average latency uses only completed attempts, including body read/validation and excluding retry backoff. Retries count separately. Pre-send key/codec refusal is zero attempts. `lastUpdatedAt` is summary-read UTC; counters reset with the API process.

Cache rate is `hits/(hits+misses)` for instrumented station/area TTL caches; zero denominator is null, and coalesced callers are separate. Synthetic/historical cache outcomes are not attributed to provider attempts or AirNow provider-cache counts. Curated-file memoization, browser and DB caches are outside that denominator. ArcGIS client traffic is explicitly “not tracked locally”; these figures do not estimate credits, billing or inbound BFF transactions.

Actual runtime capture from the configured local development app (sample catalog plus a **real file-backed historical EPA export**, no live provider activity):

Started `2026-10-27T14:25:17.836Z`; summary read `2026-10-27T14:26:39.969Z`.

| Measured field                                       | Captured value                                |
| ---------------------------------------------------- | --------------------------------------------- |
| airnow attempts / successes / failures / in flight   | 0 / 0 / 0 / 0                                 |
| aqs attempts / successes / failures / in flight      | 0 / 0 / 0 / 0                                 |
| Instrumented cache hits / misses / coalesced / stale | 3 / 3 / 0 / 0                                 |
| Cache hit rate                                       | 50% (all six measured lookups in sample mode) |
| Provider mean latency                                | null; no completed outbound attempt           |
| ArcGIS client / billing                              | not tracked locally                           |

These are captured since-start process measurements, not universal totals or a provider connection test. File-backed case memoization is outside TTL-cache counters. The export retained 71 real historical rows, unknown row certification and four source manifests. Browser errors/external requests/unnecessary station or full-case reads were all zero. 1280/390 px layouts had no document overflow; 1440/390 screenshots were visually inspected.

Evidence is ignored under `.local/milestone09/`: `usage-runtime.json`, `browser-verification.json`, `eaton-export.json`, `eaton-export.csv`, and `sources-1440.png`, `preview-1440.png`, `preview-1280.png`, `preview-390.png`, `methods-1440.png`, `usage-1440.png`. The final source details use a compact collapsed limitations disclosure. Preview/export records are ordered by source observation/validity then identity/revision; missing instants are not created.

Credential check scanned all 1,121 JS/CSS/HTML assets emitted by the current build against configured server-only credentials, AQS email and DB URL: **zero matches**. The deliberately public ArcGIS key is excluded; `ALLOW_LIVE_API_TESTS` remains false. Stale duplicate generated files are outside the exact final-build inventory.

Tests separately exercise three mocked HTTP attempts (one successful, two failed), in-flight visibility, retries, timeout, cache miss/hit/coalescing and reset. Those are explicitly mock transport outcomes, never substituted into the running UI.

## Validation

- `npm run lint`: ESLint + Prettier passed.
- `npm run typecheck`: contracts, API, web and tools passed.
- `npm test`: **192 tests / 22 files passed**.
- `npm run test:db:local`: **6 tests / 3 files passed**, including exact full historical DB export and preservation of existing snapshots.
- `npm run build`: passed; entry JS **440.61 kB / 131.84 kB gzip**. The pre-existing large lazy ArcGIS chunk warning remains.
- `npm run test:e2e`: **14 Chromium tests passed**, using isolated ports 5174/3103 without live provider keys. Four tabs, source distinctions, downloads, payload/hash matching, methods, local cache counters, ArcGIS exclusion, zero outbound counts and responsive layout verified.
- `git diff --check`: passed.

The first DB run failed because the confirmed project container was stopped (ECONNREFUSED); after starting that exact authorized target, all six integration tests passed. Early assertions were updated for the newly functional Data handoff/header, and a metrics-card E2E locator was narrowed because explanatory text contained the same phrase. The final suite passed without weakening source/security/measurement expectations. Remote CI, Firefox and WebKit were not run.

## Acceptance and Prompt 10 readiness

A01–A05 are implemented: four functional compact tabs, honest source/connection/version status, bounded provenance exports, real process metrics and offline scientific/security tests. Unknown data status and unavailable live products remain explicit. The demo reads bundled artifacts without provider acquisition; historical DB export depends on the confirmed local DB. Source quality, missing coverage and basemap usage are not solved by operational metrics.

Prompt 10 may build on the existing contracts, source lineage, export files, guarded integration boundaries and measured counters; its exact scope still requires the actual prompt. No AI assistant, cloud monitoring, user account system or billing history has been started. No commit or push was performed.
