# Prompt 06 — bounded Analysis time series

Implemented on 2026-10-26, continuing the completed Prompt 01–05 repository. Git was clean at the start. No commit/push or staging was performed.

## Delivered behavior and assumptions

`/analysis` now owns the only full time-series chart. The page contains a compact primary-station/pollutant/measurement/window toolbar, one responsive SVG chart, a slim identity/summary/comparison sidebar, contextual observation notes and a Data & Methodology link. Window choices are exactly 24/48/72 hours. A Map primary ID is retained exactly; unknown/deleted/other-pollutant identities remain explicitly unavailable until the user selects a replacement. Up to two additional identities can be selected. A shared-coordinate monitor remains a separate source identity.

The chart uses Recharts 3.10.1 with React-is 19.3.1, matching React 19.3.1. The chart library is lazy loaded. It provides SVG gaps, responsive axes and keyboard accessibility; a native timestamp inspector supplies pointer-independent access to values and missing reasons. Station lines have solid/dashed/dotted patterns and dark colors with text labels. They do not encode AQI health categories. The source unit is on the axis; AQI and concentration never share an axis.

Every plotted number is an original normalized supplied observation. Explicit one-hour period boundaries and observation equality to interval start/end establish alignment. Off-grid timestamps, unknown/daily/NowCast periods, inconsistent units/interpretation or incompatible comparisons are blocked with reasons, without conversion or resampling. Exact description/time-zone matching is conservative and documented. Underlying UTC timestamps remain distinct across DST; Los Angeles display includes PST/PDT and the inspector shows UTC.

The fixed sample fixture is unchanged and explicitly synthetic. A 72-hour chart is intentionally sparse: a 72-slot timestamp grid does not promise 72 observations. Source coverage outside the requested interval is not extended. Historical acquisition date and label remain visible; official source availability cannot be inferred from the presence of keys.

## API, storage and missing semantics

One read-only `/api/analysis-series` request accepts bounded context and up to three unique opaque station IDs. It reuses one BFF batch/cache acquisition for a fixed mode/pollutant/metric/window/snapshot; adding stations does not fan out per station or point. Original source records, slot references, acquisition metadata, incompatible-candidate reasons and summary fields are validated by shared Zod schemas. Candidate count is capped at 256, selected series at three, timestamp slots at 216 and original records at 2,000 total.

| State                               | Result                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| Single numeric record               | Plot original value; include in available count and min/max  |
| Single explicit null                | Gap; null and missing counts                                 |
| No record inside source window      | Gap; unreported and missing counts                           |
| No record outside source window     | Gap; outside-coverage and missing counts; gray chart shading |
| Multiple revisions at one timestamp | Gap; separate conflict count; retain every revision          |
| Unverified/mixed averaging or units | Block hourly series/summary; show reason                     |

Min/max use only single numeric comparable observations, including true zero and negative concentration. Missing count is absent + null + outside coverage; conflicts are separate. Available + missing + conflict equals requested timestamp slots. Peak time is omitted on ties or conflicts. Straight line segments join adjacent supplied hours only; no interpolated environmental values are created.

Analysis permits a bounded historical window to begin before snapshot coverage, marking outside coverage. It still rejects endpoints beyond the snapshot end or windows without overlap; existing station endpoints keep their full-window guard. Snapshot metadata and stored observations are immutable. PgSnapshots uses two parameterized snapshot-ID read queries supported by existing primary-key indexes (at most 2,001 observation rows before schema rejection); there is no database-wide aggregate or per-point SQL. Existing indexes and migrations suffice. No new infrastructure, schema migration, provider codec or fixture was introduced. The dedicated development database was not modified by this milestone. Integration writes are idempotent synthetic fixtures in the explicitly confirmed test database.

## Source proof and measured sample results

| Path                                   | Evidence / limitation                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample fixture → BFF → Analysis → Data | Actual local API and offline Chromium execution; all air-quality values explicitly synthetic                                                   |
| Stored PostgreSQL → bounded series     | Actual dedicated test DB replay of the existing synthetic snapshot; four integration tests passed                                              |
| Official historical mode               | Identified-snapshot guard and partial-window/source preservation tested with labeled modeled provenance; no real official dataset was acquired |
| Live AirNow                            | Contract-unverified/unavailable; failure guards tested; no production codec or authenticated live query                                        |
| AQS / OpenAI                           | No external call; no adapter/AI feature added                                                                                                  |
| ArcGIS Map handoff                     | Actual local browser verification recorded below; the map SDK/runtime was reused                                                               |

The requested 72-hour sample interval is `[2026-01-12T21:00Z, 2026-01-15T21:00Z)` and the source batch declares `[2026-01-14T21:00Z, 2026-01-15T21:00Z)`. Actual records are Jan 15, 17:00–20:00Z. For the Map-linked PM2.5 Alpha 00B concentration primary: **3 numeric observations, 69 missing slots = 20 unreported + 1 null + 48 outside coverage, 0 conflicts; range 6.2–15.5 µg/m³**. Alpha 00A separately retains 0 and -0.2, with four numeric values; Beta has three values and an absent 19:00Z record. These counts describe the fictional fixture, not LA environmental completeness or station coverage.

## Changed files

| Files                                                                                                        | Purpose                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/contracts/src/series.ts`, `index.ts`                                                               | Bounded typed series/slot/summary contracts, UTC timeline and interpretation/summary utilities                                             |
| `apps/api/src/bff/series.ts`, `query.ts`, `service.ts`, `apps/api/src/app.ts`                                | Batch series assembly, strict selection/window query, historical partial coverage and API route                                            |
| `apps/web/src/analysis/{Analysis,SeriesChart}.tsx`, `presentation.ts`, `use-analysis.ts`                     | Page controls/sidebar, compatible comparison, responsive lazy chart, local inspection, source status, cancellation/context guards          |
| `apps/web/src/{App,route-state,use-stations}.tsx` / `.ts`, `components/ModeBadge.tsx`                        | Actual Analysis routing and URL fields, Map primary preservation, active-page availability, suspend map discovery while Analysis is active |
| `apps/web/src/style.css`, `test-setup.ts`                                                                    | Responsive chart/page styling, robust nonfocused skip-link clipping, jsdom ResizeObserver stub                                             |
| `apps/web/package.json`, `package-lock.json`                                                                 | Exact chart library and matching peer dependency                                                                                           |
| `tests/unit/analysis-series.test.ts`, `apps/web/src/analysis/Analysis.test.tsx`, `apps/web/src/App.test.tsx` | DST/period/unit/gap/summary/source/query/cache and UI/deep-link/cancellation/selection tests                                               |
| `tests/integration/snapshots.test.ts`, `tests/e2e/foundation.spec.ts`                                        | Real bounded DB replay; offline Map → 72h chart → Data, actual SVG gap/tooltip/keyboard/comparison/responsive checks                       |
| `README.md`, `AGENTS.md`, BFF/research/frontend docs and this report                                         | Source/time/count/URL rules, evidence, limitations and next milestone handoff                                                              |

## Tests actually executed

Final local verification completed successfully. Earlier development runs exposed stale placeholder assertions, a fixture-specific null assumption and the need to wait for ResizeObserver after viewport changes; these were corrected using actual fixture/source behavior. The chart was not changed to fill sparse data. A first real dev-browser lifecycle check was invalidated by Vite optimizing/reloading the newly installed chart dependency; the retry prewarms it before measuring the Map handoff.

| Check                        | Final result                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run lint`               | **Passed**                                                                                          |
| `npm run typecheck`          | **Passed**                                                                                          |
| `npm test`                   | **152 passed / 16 files**                                                                           |
| `npm run test:db:local`      | **4 passed / 2 files**; confirmed `air_quality_geo_research_test` only                              |
| `npm run build`              | **Passed**, 6,294 modules; chart chunk 352.38 kB / 102.47 kB gzip, entry 379.56 kB / 115.91 kB gzip |
| `npm run test:e2e`           | **8 Chromium tests passed**; isolated ports 5174/3103; no provider/browser key needed               |
| `git diff --check`           | **Passed**                                                                                          |
| Remote CI / Firefox / WebKit | Not executed                                                                                        |

Tests cover spring-forward/fall-back UTC/local labels, 24/48/72 slots, interval-start/end interpretation, missing versus zero/negative, AQI separation, mixed units/averaging rejection, one-to-three selection cap, unavailable IDs, source-window gaps, conflicting/tied maxima, tampered summaries/context, historical provenance guards and provider failure. UI tests exercise selection, URL controls, legends/summary, blocked comparison and late canceled responses. The E2E inspects actual SVG path move commands to prove a null interior hour creates disconnected segments, and verifies tooltip/status/UTC, keyboard null inspection, three line styles, Data context and zero external requests.

The ignored `.local/milestone06/` directory contains responsive screenshots and `browser-verification.json` from the actual dev app. Actual measurements from the successful warmed dev-browser run:

| Measurement                                                          | Result                        |
| -------------------------------------------------------------------- | ----------------------------- |
| Map primary identity preserved in Analysis                           | **Yes**                       |
| Map view disposed on navigation                                      | **Yes**                       |
| Compared identities / UTC window slots per identity                  | **3 / 72**                    |
| Primary null hour produces disconnected SVG segments                 | **2 segments**                |
| Tooltip source status / explicit-null inspector                      | **Verified**                  |
| API reads during hover/keyboard inspection                           | **0**                         |
| Browser AirNow/AQS/OpenAI calls / BFF upstream delta                 | **0 / 0**                     |
| BFF cache-hit delta across verification including dependency prewarm | **9**                         |
| Unhandled browser errors                                             | **0**                         |
| Data link retains primary and 72-hour context                        | **Yes**, navigated to `/data` |
| Horizontal overflow at 1440/1280/390px                               | **None**                      |

Screenshots: `.local/milestone06/analysis-72h-1440.png`, `analysis-72h-1280.png`, `analysis-72h-390.png`; 1440px and 390px were visually inspected. The existing large ArcGIS chunk build warning remains. DB tests verify indexed columns/index availability and bounded replay/cache behavior; no database query-plan benchmark or specific planner choice is claimed. `git diff --check` passed; applied migrations, repository SQL, provider codec, Docker configuration and real environment files were not edited. No live provider verification is inferred from tile success or source keys. Real ArcGIS tiles require network/public token and are outside the deterministic offline suite; configured CI is not claimed to have run remotely.

## Acceptance and Prompt 07 readiness

| Criterion                                                                         | Status                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A01: Usable bounded Analysis with up to three stations                            | **Met**; bounded controls/comparison and local quality gates passed             |
| A02: Original observations, explicit synthetic sample, preserved source/unit/time | **Met**; no official acquisition was fabricated                                 |
| A03: True gaps, correct DST and blocked incompatible comparison                   | **Met**; shared guards, unit tests and actual SVG verification                  |
| A04: Map primary context → Analysis → Data                                        | **Met**; exercised end to end                                                   |
| A05: Deterministic API/DB/browser/build gates                                     | **Met locally**; all requested local gates passed; remote CI remains unverified |

Prompt 07 can reuse canonical pollutant/source/region/mode metadata and the four-route shell, but reporting areas and forecasts still require separately verified contracts and identity/time semantics. They must not be inserted into this monitoring-site chart as equivalent stations. Live Analysis still depends on an officially reviewed hourly adapter; real historical Analysis needs a curated official snapshot. Long-term windows, exports, wildfire scenes, interpolation, AI and deployment remain outside this milestone.
