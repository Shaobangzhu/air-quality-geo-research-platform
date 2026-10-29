# V1 freeze review — PASS WITH FOLLOW-UP

**Local Core V1 release candidate frozen for the bounded interview demonstration on October 29, 2026 (America/Los_Angeles).** All local P0 gates below passed. No unresolved P0 defect was identified in the inspected scope. This is not a production deployment or evidence that unavailable live integrations work.

Baseline: `main` at `5e05806e9c6671c777267090191ab99aad41770b` (Prompt 09), initially clean. The candidate includes the uncommitted changes below. No commit, push or Git tag was made. The [local freeze marker and measured evidence](../release/v1-freeze.json) identify this scope; future code changes require fresh verification.

**Follow-up:** remote CI passed for the baseline, but cannot certify these uncommitted changes. After an authorized commit/push, verify the new commit's Actions result. Live providers, 3D and contours are optional expansion, not prerequisites for this local freeze.

## Acceptance matrix

| Criterion                        | Result                         | Evidence and limits                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 — four-page UI               | PASS                           | `/map`, `/analysis`, `/wildfire`, `/data` only; root Map shell. One full Analysis chart, at most three compatible monitors, four internal Data tabs with one visible panel. Chromium navigation/deep links/Back, skip-link focus, Escape dismissal, loading/error/recovery and genuine empty results passed. Real four-page 1440/1280 captures visually inspected; no page overflow. Not a complete WCAG or cross-browser certification. |
| A02 — repeatable local startup   | PASS                           | Clean `npm ci`, contracts-first build/dev, keyless isolated-port E2E and actual dev startup with dedicated PostgreSQL passed. Status, migrations and explicit-target seeds executed; repeated seeds retained IDs/counts. README documents fresh-checkout steps and separate provisioning. A second clean machine/container was not provisioned during this audit.                                                                        |
| A03 — truthful scientific states | PASS                           | Sample remains synthetic; historical rows retain uncertainty; unavailable Live never silently falls back. Tests/source review cover AQI vs concentration, sites vs areas, predictions vs observations, negative values, null/absent/conflicting slots, units/periods, identity, UTC and DST. No authenticated provider workflow claimed.                                                                                                 |
| A04 — reproducible Eaton case    | PASS                           | Checksummed official artifacts and immutable case/snapshot manifest; 71 supplied EPA rows across 72 UTC slots. Missing Jan 8 05:00 PST verified in browser. Incident, study, static perimeter and SRA/LRA dates remain separate. 3D/contours/smoke explicitly unavailable.                                                                                                                                                               |
| A05 — transparency and exports   | PASS                           | Catalog distinguishes integration from scientific status. Real historical CSV/JSON downloads retain 71 records and source manifests. Preview hash, escaping, null representation and bounds have unit/API coverage. Actual browser run recorded 9 cache hits, 5 misses and zero provider attempts; ArcGIS traffic excluded and labeled.                                                                                                  |
| A06 — quality/security/demo      | PASS locally; remote follow-up | 193 unit/API/React tests, 6 PostgreSQL tests and 19 Chromium E2E tests passed, plus lint/types/build. Configured server-secret comparison found zero hits in current client assets and tracked/nonignored text. Remote baseline succeeded; local candidate not yet remotely run. Twelve runtime screenshots and a 4:45 demo guide included.                                                                                              |
| A07 — V1 boundary                | PASS                           | No fifth page, LLM/RAG, cloud deployment, source-attribution model or Prompt 11/12 requirement. Implemented and unavailable/planned behavior separated in README and known issues.                                                                                                                                                                                                                                                       |

## Scoped repairs and changed files

| Finding                                                   | Change                                                                                                                                                                       | Verification                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sample seed command absent                                | `scripts/seed-sample.ts`, `package.json`: explicit matching project target; fixed synthetic fixture through existing content-addressed storage                               | Ran twice on approved dev DB: same snapshot, 69 observations; repository idempotency/integration coverage retained |
| Vite prefix allowlist also matched sibling variable names | `apps/web/vite.config.ts`: disable prefix exposure; define only exact public `VITE_ARCGIS_API_KEY`                                                                           | New `tests/unit/browser-environment.test.ts`, types/build, keyless E2E, online ArcGIS capture and asset scan       |
| Release failure/empty coverage incomplete                 | `tests/e2e/release-readiness.spec.ts`: four delayed/503/recovery flows plus real Inland Empire PM10 empty flow through Map/Analysis/export                                   | Five added tests; total 19 passed without disabling gates                                                          |
| Source text split midword at 1280px with detail drawer    | `apps/web/src/style.css`: keep source status chips and Details buttons on one line                                                                                           | Build/E2E repeated; regenerated and inspected `data-1280.png`; no document overflow                                |
| CI lacked explicit seed CLI repetition                    | `.github/workflows/ci.yml`: run each seed twice against ephemeral test service                                                                                               | Local CLI/storage checks passed; amended workflow awaits authorized push and remote run                            |
| Stale/missing startup and release docs                    | Reworked `README.md`, updated `docs/architecture/database.md`; added this review and `docs/release/` architecture, demo, STAR stories, limitations, evidence and screenshots | Commands exercised; source/version claims reviewed; documentation links checked locally                            |
| Repeatable release evidence absent                        | `scripts/capture-v1.mjs`, `scripts/audit-artifacts.mjs`                                                                                                                      | Actual Chromium captures/downloads and configured-value scan executed; capture uses no mocked API responses        |

No dependency/lockfile update, migration edit, historical artifact rewrite, provider codec, infrastructure change or new product feature was introduced.

## Executed verification

Environment: macOS, Node **24.19.0**, npm **11.17.0**, PostgreSQL **18.6**, Playwright Chromium. Clean install used the existing checkout and lockfile. These commands were actually executed during this audit.

| Command/check                                                                 | Exact outcome                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                      | PASS — 540 packages installed; lockfile unchanged. npm reported three packages with pending install-script approval; no new permissions granted and downstream build/tests passed. |
| `npm audit --json`                                                            | PASS — zero reported advisories at audit time; 592 dependency entries. Registry evidence, not a security guarantee.                                                                |
| `npm run lint`                                                                | PASS — ESLint and Prettier                                                                                                                                                         |
| `npm run typecheck`                                                           | PASS — contracts build and strict API/web/tool TypeScript checks                                                                                                                   |
| `npm test`                                                                    | PASS — **193 tests / 23 files**                                                                                                                                                    |
| `npm run build`                                                               | PASS — contracts, API and web; existing ArcGIS chunk-size warning remains                                                                                                          |
| `npm run test:e2e`                                                            | PASS — **19 tests**, final run **11.5 s**, isolated ports 5174/3103, no provider keys                                                                                              |
| `npm run db:status`                                                           | PASS — connected to confirmed project target                                                                                                                                       |
| `npm run db:migrate`, twice                                                   | PASS — both reported “Migrations already current.”                                                                                                                                 |
| `npm run db:seed:sample -- --target air_quality_geo_research`, twice          | PASS — same synthetic snapshot ID and 69 rows                                                                                                                                      |
| `npm run db:seed:historical-case -- --target air_quality_geo_research`, twice | PASS — same historical snapshot ID and 71 rows                                                                                                                                     |
| `npm run test:db:local`                                                       | PASS — **6 tests / 3 files**, separate confirmed test DB                                                                                                                           |
| `node scripts/capture-v1.mjs`                                                 | PASS — 12 captures, connected DB, online Map/Wildfire basemaps, zero uncaught page errors and document overflow                                                                    |
| Configured-secret scan                                                        | PASS — **1,121 current client assets**, eight configured server-secret fields checked, zero matches; exact source-file count retained in marker                                    |
| `git diff --check` and immutable-path diff                                    | PASS — no whitespace errors; no changes under `db/migrations`, `fixtures/historical` or `package-lock.json`                                                                        |

Local raw outputs are `/private/tmp/aq10-*.log` and `/private/tmp/aq10-audit.json`; ignored browser/download/DB details are in `.local/milestone10/`. These machine-local files are not required repository artifacts. The [freeze evidence](../release/v1-freeze.json) and screenshots preserve relevant results without credentials or raw server configuration.

Initial sandbox socket/DNS restrictions required approved retries. One E2E attempt was not dispatched because automatic approval was temporarily out of credits; a later approved retry passed. The new empty-state test initially used the coastal preset, where real fixtures contain monitors; it was corrected to the genuinely empty Inland Empire preset. No failing product gate was suppressed.

## Docker, migrations and data

Existing **air-quality-geo-research-platform-postgresql** was running/healthy with `postgres:18.6-bookworm`, published only at `127.0.0.1:55436`. It was inspected and used, not recreated or reconfigured. No unrelated container, volume or database was changed or queried; `cpi-postgres` remained untouched.

Only `air_quality_geo_research` and `air_quality_geo_research_test`, schema `aq_workbench`, were queried. Both application roles have superuser, create-role, create-database, replication and bypass-RLS flags disabled. Migration rows/checksums match on both targets:

| Migration                  | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `001_foundation.sql`       | `1295a2f828b702e8348c4783e866855b2db4a66a33cd7df4c2bb7c5e57fe2aea` |
| `002_station_bff.sql`      | `a97af6af9ef66716eaa613e5013afd24b6dc731e2e02f6e0defb7102a11a36fb` |
| `003_historical_cases.sql` | `af64265b1e32e51f5642136d1d123628a27faf7271546b8b91d74eadd8e85618` |

Repeated dev seeds retained synthetic snapshot `95fca99d-e1e1-4488-bcd2-ff21825ed948` (69 rows) and historical snapshot `332c4c1e-9ccf-40d7-bfbd-4444744e7af7` (71 rows); Eaton links to the latter. Test DB retains equivalent fixtures plus a two-row SQL-value regression snapshot. No destructive cleanup, pruning, schema adoption or applied-migration modification occurred.

## Science, provider and security findings

Actual contracts, normalizers, API boundaries, services/cache/storage, map lifecycle, routing, chart presentation, wildfire loaders and exports were inspected alongside tests. This is a bounded implementation audit, not independent scientific validation of every measurement.

- **Data meaning:** raw zero/negative values retained; null, absent, conflicting and outside-coverage slots remain gaps. Comparisons require consistent units and explicit hourly alignment. Provider/site/parameter/POC distinguish co-located monitors. Area aggregates and date-only forecasts have separate contracts, without inferred official geometry or issuance times.
- **Eaton:** study Jan 6–8 PST (`2025-01-06T08:00Z` to `2025-01-09T08:00Z`, exclusive end), incident Jan 7–31. Monitor 06-037-1103 / POC 3 / parameter 88101 / method 170 has 71 records; Jan 8 05:00 PST is absent. Row certification remains unknown. Static `firep25_1` is April 2026 context; SRA is April-2024-effective; LRA 2025 recommendations postdate ignition, adoption unknown. Display clipping/topology repairs are documented derivatives; historical source bytes/checksums preserved.
- **References rechecked:** [CAL FIRE incident](https://www.fire.ca.gov/incidents/2025/1/7/eaton-fire) supports incident dates; [EPA AirData formats](https://aqs.epa.gov/aqsweb/airdata/FileFormats.html) supports monitor identity/time/qualifier interpretation; [OSFM FHSZ](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones) describes hazard, not immediate risk. No new causal/source-attribution claim.
- **AirNow:** [official June 2026 notice](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf) lists replacement services and September 30 retirement of six legacy services. Production wire codecs remain absent; normalized fixtures do not verify wire contracts. No authenticated AirNow, AQS or OpenAI request was made. Live-test flag remained false.
- **HTTP/cache/usage:** actual-send instrumentation, bounded retry/timeout/body size, Retry-After handling, in-flight accounting, TTL/dedup/stale labels and capacity refusal inspected/tested. Counters cover instrumented station/area TTL caches, excluding curated file memoization, database/browser caches and ArcGIS client billing. A 1.5-second idle observation recorded zero API requests; this is not a soak test.
- **Exports:** 10-row preview, 500 selected records, 3 MB, four concurrent operations; selection hash binds export to preview. CSV embeds a manifest, uses null `\N`, hardens spreadsheet cells and preserves lossless `record_json`. Actual CSV/JSON downloads contained the same 71-row historical selection and lineage. Tests cover escaping, wrong hashes and bounds.
- **Security:** loopback targets, parameterized runtime values, safe errors, validated source URLs and migration ownership/checksums retained. Exact public ArcGIS exposure now enforced. Scan compares configured server keys/email/DB URL/password against current client assets and tracked/nonignored text without printing values; deliberately public browser token excluded. Provider-dashboard token/referrer settings were not independently inspected. No penetration-test or perfect-security claim.

## Browser evidence and interview artifacts

Latest capture began **2026-10-29T04:23:04.955Z** (October 28, 21:23 PDT) on actual local React/Express and confirmed DB. Twelve full-page PNGs use a 1000px viewport height:

| View           | 1440px                                              | 1280px                                              |
| -------------- | --------------------------------------------------- | --------------------------------------------------- |
| Map            | [Capture](../release/screenshots/map-1440.png)      | [Capture](../release/screenshots/map-1280.png)      |
| Analysis       | [Capture](../release/screenshots/analysis-1440.png) | [Capture](../release/screenshots/analysis-1280.png) |
| Wildfire       | [Capture](../release/screenshots/wildfire-1440.png) | [Capture](../release/screenshots/wildfire-1280.png) |
| Data Sources   | [Capture](../release/screenshots/data-1440.png)     | [Capture](../release/screenshots/data-1280.png)     |
| Preview/export | [Capture](../release/screenshots/export-1440.png)   | [Capture](../release/screenshots/export-1280.png)   |
| API Usage      | [Capture](../release/screenshots/usage-1440.png)    | [Capture](../release/screenshots/usage-1280.png)    |

Map retained its existing ArcGIS component across pollutant changes; Analysis released it, plotted three compatible series and preserved line breaks; Wildfire mounted one view and exposed the absent hour. Both actual basemaps loaded online. Separate keyless E2E verifies explicit fallback without remote tiles. Online basemaps are not offline capability or live air-quality evidence.

Keyboard evidence includes Tab → skip link → Enter → focused workspace, Escape drawer dismissal, accessible controls and deep-link/Back flows. Map additionally has a 390px overflow check. All four desktop pages were visually inspected; only source-table wrapping required repair. Full mobile, screen-reader, Firefox/WebKit and formal performance/WCAG audits remain outside this evidence.

Interview materials: [README](../../README.md), [one-page architecture](../release/architecture.md), [4:45 demo and research questions](../release/demo-guide.md), [two STAR stories](../release/engineering-stories.md). Reproduce screenshots with `node scripts/capture-v1.mjs` after startup; downloaded exports/detailed run state stay ignored.

## Remote CI and smallest remaining list

GitHub Actions [run 40535979940](https://github.com/Shaobangzhu/air-quality-geo-research-platform/actions/runs/40535979940), push on `main`, succeeded October 27, 2026 at **16:07:46 UTC** for baseline `5e05806e9c6671c777267090191ab99aad41770b`. GitHub run/job metadata verified install, lint, types, unit tests, build, DB status, repeated migration, DB tests, Chromium installation and E2E success. Failure-artifact upload was correctly skipped. Remote used ephemeral PostgreSQL 17; local used 18.6.

1. No mandatory local P0 repair remains for the stated demo scope.
2. After authorized commit/push, verify Actions for the new SHA, including added seed CLI steps. New-commit remote CI is currently **not run**.
3. Optional follow-ups are in [known issues](../release/known-issues.md): verified live codecs, broader browser/accessibility coverage, SDK bundle optimization and independently verified 3D/contours. No expansion is required for an honest Core V1 demo.

The existing ArcGIS bundle warning remains: runtime approximately 1.14 MB minified / 272.5 kB gzip. No formal low-end-device/latency benchmark, external provider authentication, new-machine provisioning or token-dashboard check was performed. These limits are explicit rather than masked by synthetic data or inferred success.
