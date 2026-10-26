# Prompt 04 — monitoring-site observations end to end

Implemented on **2026-10-25**. The repository was clean at the start. No commit or push was made.

## Delivered behavior and measured data

Map Explorer now draws available monitoring-site readings through the existing Express BFF, with one persistent ArcGIS station layer, independent AQI/concentration rendering, synchronized legends and a conditional source-aware detail drawer. Map selection and the keyboard identity list share validated selection state. Co-located monitors retain source coordinates and independent identities; clicking their shared symbol presents a monitor chooser. Analyze This Station opens `/analysis` with the selected opaque `stationId`, pollutant, mode, metric and optional historical snapshot. Analysis remains an honest planned-chart page with the selected context visible.

Measured through the actual local sample API and configured ArcGIS browser:

| Item                                 | Actual result                                                     |
| ------------------------------------ | ----------------------------------------------------------------- |
| Air-quality data mode                | **Synthetic sample**                                              |
| Requested interval                   | `[2026-01-14T21:00:00Z, 2026-01-15T21:00:00Z)`                    |
| Latest supplied observation          | **2026-01-15T20:00:00Z**, displayed as Jan 15, 2026, 12:00 PST    |
| PM2.5 monitor identities returned    | **3**                                                             |
| Distinct source coordinate locations | **2**                                                             |
| Latest records returned              | **6** — one supplied AQI and one concentration per identity       |
| Shared-location chooser              | **2** distinct monitor choices                                    |
| Fixture identity examples            | `SAMPLE-00001` monitors `00A`/`00B`; `SAMPLE-00B02` monitor `00A` |
| Actual fixture latest values         | 35 AQI and 15.5 µg/m³; synthetic, source status **unknown**       |

These counts/values describe the fixed fixture/window, not real LA monitoring coverage. O3 and PM10 are also covered by deterministic API tests. No fixture, stored snapshot or database content was changed. The geographic basemap is real ArcGIS context; all displayed air-quality data remains explicitly synthetic.

## Changes

| Files                                                                                                                                          | Purpose                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/bff.ts`                                                                                                                | Shared bounded station-reading response, including context/source/identity/extent validation                                                |
| `apps/api/src/app.ts`, `apps/api/src/bff/service.ts`                                                                                           | Read-only `/api/station-readings`, reusing existing query, provider, cache and snapshot paths                                               |
| `apps/web/src/use-stations.ts`                                                                                                                 | One typed map read per meaningful context; cancellation and response-context validation                                                     |
| `apps/web/src/route-state.ts`, `apps/web/src/App.tsx`                                                                                          | Metric URL state, canonical `stationId`, legacy link compatibility and validated Analyze context                                            |
| `apps/web/src/map/{arcgis-runtime,MapCanvas,MapExplorer}.tsx` / `.ts`                                                                          | One station GraphicsLayer, incremental graphics/selection updates, bounded hit testing, co-location chooser and layer controls              |
| `apps/web/src/map/station-presentation.ts`, `StationLegend.tsx`                                                                                | AQI categories, independent concentration display bins, neutral/missing/stale/ambiguous symbols and DST-aware time formatting               |
| `apps/web/src/components/StationDrawer.tsx`, `apps/web/src/style.css`                                                                          | Compact readings, complete source/status/time/period details, Analyze link and responsive scroll behavior                                   |
| `tests/unit/station-readings.test.ts`                                                                                                          | Supertest/service tests for latest records, identity, null/zero/negative values, invalid coordinates, cache, stale failure and source modes |
| `apps/web/src/App.test.tsx`, map test files                                                                                                    | Drawer/navigation/legend/URL behavior, no passive refetch and stubbed SDK reuse/hit-test/dispose tests                                      |
| `tests/e2e/foundation.spec.ts`                                                                                                                 | Actual sample BFF selection → Analyze path, source labels, timestamp/status, no passive refetch and zero upstream attempts                  |
| `docs/frontend/{station-observations,design-system,arcgis-map}.md`, `docs/architecture/provider-bff.md`, `README.md`, `AGENTS.md`, this report | Scientific semantics, symbol/status vocabulary, lifecycle/source limits and handoff evidence                                                |

No dependency, SDK version, provider wire codec, repository, migration, Docker container/volume or real environment file was changed. The SDK remains **5.1.27**. Tests used dedicated ports 5174/3103 and preserved the running development servers.

## Scientific and performance choices

The new map endpoint reads one bounded cached batch, clips source WGS84 coordinates/time, and returns latest supplied timestamps separately for AQI and concentration. It retains all tied revisions/periods and never substitutes an older non-null record, averages monitors, converts units or calculates AQI. The counterpart metric appears only when that batch actually supplied it; missing counterparts remain explicitly unavailable. Existing full observation endpoints remain compatible.

Source identities preserve leading zeroes/letters and optional monitor/parameter components. Existing normalization rejects malformed/invalid/out-of-coverage rows with safe diagnostics, deduplicates exact revisions and preserves distinct periods/conflicts. The map response validates source/provider/mode/agency, selected pollutant/window, station ID and extent. Blank malformed numeric strings are rejected; normalized missing values use null. True zero and small negative source concentrations survive.

Supplied AQI uses the [official six category ranges](https://www.airnow.gov/aqi/aqi-basics/), with dark symbol outlines and text labels. Concentration uses blue display bins and source units, explicitly **not health thresholds**. Negative concentration has a separate triangle. Missing, stale or multiple latest records use a neutral diamond with a textual reason. Cache staleness and delayed live records retain original values/timestamps; fixed old sample/historical dates do not become stale just because current wall-clock time is later. Source preliminary/validated/unknown status remains independent of mode and category.

Default map pagination is 200 identities; query limit is at most 500, with existing source bounds of 256 identities/2,000 observations. Latest response revisions total at most 2,000. One component-owned view contains the engineering extent and **one** station layer. Graphics are keyed by stable ID, selection/visibility updates reuse the layer, and old-context graphics clear during loading/errors. Map pan, legend/layer toggles, drawer selection and Analyze navigation do not request observations. Hit-test generation guards discard late results after data updates/disposal. List selection works without basemap tiles and provides keyboard equivalence. Zoom sits bottom-right to avoid the legend.

The drawer shows native identity, source WGS84 coordinates, pollutant, available AQI/concentration and source unit, source validation status, observed/fetched UTC and `America/Los_Angeles` PST/PDT, averaging meaning/description/interval/source time zone, source agency, transport provider and qualifier. Tied records remain separately inspectable. A single Analyze link hands off validated context without adding a chart or a fifth page.

## Live, historical and mock evidence

| Path                                                    | Evidence and limit                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample BFF → map → drawer → Analyze                     | **Actually executed** with fixed synthetic fixtures and a real ArcGIS browser map                                                                                                                                                                  |
| ArcGIS hit testing/lifecycle                            | **Actually executed**: 2 co-located choices, same map/view/station layer, 3 graphics, disposal on Analyze                                                                                                                                          |
| Live AirNow                                             | **Unavailable / contract-unverified**. No production codec was added and no authenticated provider request was made. The public official catalog was rechecked; it still exposes capability descriptions rather than the exact hourly wire schema. |
| Historical official snapshots                           | Existing PostgreSQL path reused, with official provenance/mode validation. New endpoint behavior tested with explicit repository doubles; no actual official historical dataset was acquired/imported.                                             |
| Stale failure, invalid inputs and conflicting revisions | Deterministic provider/repository doubles and import fixtures; these are not official remote verification                                                                                                                                          |
| Server provider traffic                                 | Actual browser recorded **0** AirNow/AQS/OpenAI requests; local usage summary reported **0** AirNow/AQS outbound attempts                                                                                                                          |

The [AirNow verification constraint](../data-sources/airnow-live-verification.md) remains in effect. `ALLOW_LIVE_API_TESTS=false` was preserved. A missing/unverified live target and an absent/wrong-mode historical snapshot show an explanatory unavailable/error state; neither falls back to sample. Browser ArcGIS access uses the existing intentionally public token; account-side privilege/referrer settings were not independently audited.

## Verification results

| Command / check                                            | Final result                                                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                             | **PASS** — ESLint and Prettier                                                                                                                            |
| `npm run typecheck`                                        | **PASS** — contracts, API, frontend and tools                                                                                                             |
| `npm test`                                                 | **PASS — 126 tests / 13 files**                                                                                                                           |
| `npm run build`                                            | **PASS** — contracts/API/web; 5,848 modules transformed; web entry about 359.29 kB / 111.04 kB gzip; lazy ArcGIS chunk about 1,141.08 kB / 272.45 kB gzip |
| `npm run test:e2e`                                         | **PASS — 6 Chromium tests**, keys cleared, actual local sample BFF; selection → Analyze path and 1440/1280/390px overflow checks                          |
| Real ArcGIS browser inspection                             | **PASS** — visible basemap/station graphics at 1440×900, concentration drawer at 1280×900; 0 unhandled browser errors                                     |
| Actual lifecycle/performance probe                         | **PASS** — same map element, view and station layer; 2 total layers / 3 station graphics; **0 passive read requests**; view destroyed on exit             |
| Built JS/CSS credential scan                               | **PASS — 1,116 assets**, no configured AirNow key, AQS key/email, OpenAI key or DB URL found; public ArcGIS token is the intentional browser exception    |
| `git diff --check`; preserved DB/provider/dependency files | **PASS**                                                                                                                                                  |
| DB integration / remote CI / other browser engines         | Not run: repository/schema unchanged; no remote CI result or broader browser support claimed                                                              |

Tests cover multiple pollutants, leading-zero IDs, near-duplicate/co-located monitors, exact deduplication, period/revision ties, null/blank/zero/negative values, invalid/out-of-scope coordinates, stale/delayed behavior, DST, response mismatch, layer visibility, drawer/Analyze context and view update/dispose behavior. SDK unit tests use stubs and perform no tile/network request. Supertest and Chromium required permission for local sockets. One screenshot refresh overlapped development reloads from concurrent builds and was rerun successfully after those processes finished; final inspection waited for view updates/tiles to settle. Vite's existing large SDK chunk warning remains visible; no offline tiles or performance benchmark is claimed.

## Screenshots and artifacts

Ignored local artifacts are retained in `.local/milestone04/`:

- [Actual ArcGIS AQI map, 1440px](../../.local/milestone04/map-aqi-real-1440.png)
- [Actual concentration map and selected reading drawer, 1280px](../../.local/milestone04/map-concentration-drawer-real-1280.png)
- [Missing-key fallback, 1440px](../../.local/milestone04/map-no-key-1440.png)
- [Missing-key fallback with selected drawer, 1280px](../../.local/milestone04/map-no-key-drawer-1280.png)
- [Responsive missing-key fallback/drawer, 390px](../../.local/milestone04/map-no-key-drawer-390.png)
- [Safe browser verification measurements](../../.local/milestone04/browser-verification.json)

Actual 1440/1280 screenshots and the 390px fallback were visually reviewed. Esri attribution remains visible. Geographic tiles remain network/token-dependent; an unavailable map preserves the reading list and shell. Desktop drawers scroll internally; narrow drawers stack below the map without an internal height cap.

## Acceptance and Prompt 05 readiness

| Criterion                                                  | Status                                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 — responsive map, stable selection and accurate legend | **PASS** — available source data only; actual synthetic map/hit test and deterministic edge cases                                                           |
| A02 — provenance and validation status visible             | **PASS** — sample labels, original source/provider and unknown/preliminary/validated vocabulary; no invented official IDs/values                            |
| A03 — verified live only; sample/historical separated      | **PASS for mode isolation** — live remains explicitly unavailable pending official codec verification; historical behavior verified with repository doubles |
| A04 — actionable Analyze route with validated selection    | **PASS** — real-browser navigation and unit/E2E assertions                                                                                                  |
| A05 — checks pass, view reused and server secrets isolated | **PASS**                                                                                                                                                    |

Prompt 05 can refine pollutant/region linked workflows on the validated `stationId`/metric/mode context, stable graphics layer and single bounded map-read path. Preserve co-located identities, independent periods/metrics, source units and canceled-request guards. Live still requires an exact official wire specification, reviewed codec and explicitly opted-in bounded verification. Real historical use requires a curated official snapshot. Full time-series charts remain Prompt 06; forecasts, wildfire, 3D, export, AI and cloud deployment remain outside this milestone.
