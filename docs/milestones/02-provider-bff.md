# Prompt 02 — station BFF implementation and verification

Date: **2026-10-25**. The repository was clean before this milestone. Prompt 01's actual code/report and the existing isolated PostgreSQL target were inspected first. No commit/push, new Docker stack, container/volume change or unrelated database operation was performed.

## Result and remaining provider limitation

The normalized sample BFF, identified-snapshot historical read path, bounded PostgreSQL repository, explicit errors, mode-aware cache, coalescing, stale state and usage metrics are implemented. A production AirNow live wire codec is **not enabled**: the publicly accessible official catalog confirms `/aq/data/` but does not expose sufficient detailed request/response specifications. No parameter/response-field guesses were shipped. This follows the requested fixture-backed uncertainty path rather than presenting fictional live results.

All local key fields were present. `ALLOW_LIVE_API_TESTS=false` was preserved. The smoke gate actually ran and reported NOT RUN (exit 2), with no provider request. AirNow/AQS/ArcGIS/OpenAI received no authenticated request. HTTP retry/timeout/normalization behavior is verified with controlled mocks; that evidence is not labeled live-tested. See [AirNow evidence](../data-sources/airnow-live-verification.md).

## Domain/API implementation

Shared ESM exports remain browser/Node compatible. Existing foundation definitions moved intact to `domain.ts`; the public index re-exports those and the new BFF contracts. No provider SDK or new dependency was added.

- Identity retains provider, native string ID, optional monitor and parameter identity. Co-located monitors and different averaging periods remain distinct. Exact duplicate revisions are diagnosed; conflicting revisions are preserved and marked partial.
- Measurements discriminate AQI/concentration, preserve compatible units, raw negatives/zero/null, UTC observation/fetch times, original source agency, transport provider, status and source references. No scientific calculation or implicit unit conversion exists.
- Public result metadata includes complete/partial/empty state, requested vs available coverage, safe row diagnostics, cache/stale/error state, optional persisted snapshot and bounded pagination. Completeness is not a guarantee of continuous temporal coverage.
- All API inputs and public response shapes have Zod contracts. Provider exceptions/response bodies and user query values are not reflected in errors.

| GET endpoint                     | Implemented behavior                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/api/regions`                   | Frozen engineering extent, EPSG:4326                                                            |
| `/api/data-products`             | Station-observation capability and mode limitations                                             |
| `/api/stations`                  | Normalized selected monitor identities; sample works without DB/provider keys                   |
| `/api/stations/:id/observations` | Opaque-ID station series with raw/normalized semantics and provenance                           |
| `/api/datasets`                  | Local snapshot metadata, source verification descriptors and explicit unavailable-storage state |
| `/api/usage/summary`             | Since-process-start provider attempt/latency and cache counters                                 |
| `/api/health`                    | Safe DB state and configured data capability; no provider fetch                                 |

Full input limits, error codes and examples: [provider BFF](../architecture/provider-bff.md). Mode/import semantics: [data modes](../architecture/data-modes.md).

## Cache and metric definitions

The canonical cache key includes mode, region/upstream bbox, pollutant, measurement kind, requested UTC interval/window and snapshot ID. Filtering station/sub-bbox/pagination uses one region result. Defaults: 32 entries / 8 MB / four distinct in-flight loads, 300-second TTL and 900-second stale grace. TTL is an engineering starting point informed by the official general hourly cadence, not an AirNow quota or measured production optimum.

Fresh hits avoid a load. Same-key in-flight requests coalesce. Failed revalidation may return the original same-mode value within grace with original timestamps and explicit stale reason; it never substitutes sample numbers. HTTP attempts are bounded by body/time/retry limits and redirects are rejected.

Provider `requests` counts **completed HTTP attempts including retries**; successes require 2xx plus bounded body/decoder success, failures count all other completed attempts. Latency includes body/validation and excludes backoff. Cache misses start a load, hits return a fresh value, coalesced callers are separate, and hit rate is hits/(hits+misses), null for no decisions. DB and synthetic/historical cache activity are not outbound AirNow/AQS requests. ArcGIS is labeled `not tracked locally`.

Mock proof: 20 concurrent callers caused one load and two HTTP invocations (one failed attempt, one successful retry); a later hit caused no extra invocation. Production compiled smoke had **zero outbound provider attempts**. Details: [usage counting](../architecture/api-usage.md).

## PostgreSQL verification

`002_station_bff.sql` adds `data_sources`, `monitoring_sites`, `observations`, `data_snapshots` and `snapshot_imports` under the existing `aq_workbench` schema. Runtime SQL uses bind parameters/bulk JSON recordsets; identity and revision keys preserve monitor/period semantics. There is no PostGIS dependency or data reset.

Capacity is 32 snapshots / 512 monitor identities / 2,000 observations per snapshot, enforced by an advisory-locked transaction. New imports are refused at capacity without deleting old data. Snapshot content hashing makes identical imports idempotent; snapshot-time station metadata is immutable even when registry metadata is updated.

Actual development target: `air_quality_geo_research`, role `aq_workbench_app`, existing `air-quality-geo-research-platform-postgresql` on loopback port 55436. Both migrations were applied and repeated. A before/after comparison confirmed the foundation row and existing migration checksum were unchanged.

The development DB now has 3 source descriptors, 9 parameter/monitor identities, 69 observations, 1 snapshot and 1 import record. That snapshot is **sample / synthetic only**. The 9 identities represent three fictional monitor identities over three pollutants, including two co-located monitors; they are not nine asserted physical sites. No official historical/live numeric dataset was acquired or created.

The separate `air_quality_geo_research_test` database passed real migration/repository tests. They preserve distinct monitors/periods, null/negative values, replay identical normalized batches, prove idempotence, and persist SQL-shaped IDs/names as literal data while keeping foundation intact. Test-modeled official provenance stays in mock tests and is not imported as an acquired official dataset.

## Commands/checks actually executed

| Check                                                                   | Result                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                          | **PASS** — ESLint and Prettier                                                                                |
| `npm run typecheck`                                                     | **PASS** — shared package, apps, scripts/tests                                                                |
| `npm test`                                                              | **PASS** — 95 tests across 9 files, provider HTTP fully mocked                                                |
| `npm run build`                                                         | **PASS** — shared declarations/ESM, Node API and Vite web                                                     |
| `npm run test:e2e`                                                      | **PASS** — 2 Chromium tests, all provider keys cleared; actual sample endpoints and navigation/mobile checked |
| `npm run db:migrate` twice                                              | **PASS** — applied 002 then already current; 001 preserved                                                    |
| `npm run test:db:local`                                                 | **PASS** — 3 real PostgreSQL tests in 2 files                                                                 |
| `npm run snapshots:import -- --file fixtures/synthetic/bff-hourly.json` | **PASS** — 69 labeled sample observations persisted                                                           |
| Compiled Node API smoke on alternate loopback port                      | **PASS** — 3 sample monitors, normalized station series, cache hit, local dataset metadata, connected DB      |
| Compiled live-mode request                                              | **PASS guard** — 503 contract-unverified; zero provider attempts                                              |
| Sample snapshot requested as historical                                 | **PASS guard** — 409 mode mismatch; no substituted result                                                     |
| Credential scan of compiled responses/browser assets                    | **PASS** — no configured server key or AQS email found                                                        |
| `npm run provider:airnow:smoke`                                         | **NOT RUN externally** — false flag preserved, intentional exit 2                                             |
| Actual provider HTTP / official historical acquisition                  | **NOT RUN**                                                                                                   |
| GitHub Actions                                                          | **Configured, not verified remotely**; existing workflow globs include the new unit/integration tests         |
| Dependency installation                                                 | No new dependency; lockfile unchanged; clean install previously verified in Prompt 01                         |

An early helper type and an Express error-handler lint issue were corrected. The formatter required a second pass for one method chain; final formatting checks pass. The development preview was restored after the isolated browser tests. No additional page implementation was performed; health now truthfully advertises sample API capability.

## Acceptance and Prompt 03 dependencies

| Criterion                                     | Status                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A01 normalized, source-grounded responses     | **PASS for labeled sample**; identified historical path tested; live intentionally unavailable pending wire evidence |
| A02 bounded isolated PostgreSQL               | **PASS** — tables, migration replay and data preservation verified                                                   |
| A03 cache/coalescing reduces requests         | **PASS with exact mocked HTTP counts**; no production quota-saving claim                                             |
| A04 honest usage counters                     | **PASS** — attempts/retries/cache/latency definitions and zero-traffic guards tested                                 |
| A05 truthful failures/modes                   | **PASS** — no silent sample fallback; stale and unsupported states explicit                                          |
| A06 local quality gate / provider uncertainty | **PASS locally**; remote CI and live capabilities remain unverified                                                  |

Prompt 03 may consume the shared catalog/station/observation/error/usage contracts and deterministic sample API, and rely on the migrated isolated DB and bounded snapshot importer. The four supplied screenshots remain UI references for later work. It must not assume live AirNow works, that an official historical dataset exists, that AQS has an HTTP adapter, or that ArcGIS billing/tile usage is tracked locally. Verify current ArcGIS integration separately for that milestone; server secrets must remain out of VITE variables. No provider BFF caller should bypass the existing mode service or contract guard.

## Changed-file inventory

| Area             | Files                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts | `packages/contracts/src/index.ts`, `domain.ts`, `bff.ts`                                                                                                                                                                        |
| API boundary     | `apps/api/src/app.ts`, `config.ts`, `server.ts`                                                                                                                                                                                 |
| BFF modules      | `apps/api/src/bff/cache.ts`, `catalog.ts`, `errors.ts`, `http.ts`, `normalize.ts`, `providers.ts`, `query.ts`, `repository.ts`, `runtime.ts`, `service.ts`, `usage.ts`                                                          |
| DB/import        | `db/migrations/002_station_bff.sql`, `scripts/import-snapshot.ts`, `scripts/airnow-smoke.ts`                                                                                                                                    |
| Fixtures/config  | `fixtures/synthetic/bff-hourly.json`, `fixtures/README.md`, `.env.example`, `package.json`, `playwright.config.ts`                                                                                                              |
| Tests            | `tests/helpers/bff.ts`, `tests/unit/bff-{api,cache,http,normalize,repository}.test.ts`, `tests/unit/api.test.ts`, `tests/integration/{migrations,snapshots}.test.ts`, `tests/e2e/foundation.spec.ts`                            |
| Docs             | `docs/architecture/{provider-bff,data-modes,api-usage,database,decisions}.md`, `docs/data-sources/{airnow-live-verification,provider-capabilities}.md`, `docs/research/data-semantics.md`, milestone reports, README and AGENTS |

Real env files, the pre-migration baseline and generated/test/build outputs remain ignored. No real source key, authenticated request URL or DB dump was added.
