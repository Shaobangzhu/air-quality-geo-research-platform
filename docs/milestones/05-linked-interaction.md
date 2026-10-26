# Prompt 05 — pollutant exploration and linked interaction

Implemented 2026-10-25 against the completed Prompt 01–04 repository. Git was clean at the start. No staging, commit or push was performed.

## Delivered UX and state

The compact Map Explorer now offers PM2.5, O3 and PM10 with three engineering region presets. Region selection updates query clipping, the dashed study rectangle and the existing map extent. The only enabled data product is Monitoring Stations; Reporting Areas and Forecasts are explicitly disabled as unavailable. Existing sample/historical/live limitations remain visible and distinct. AQI and concentration legends retain separate semantics, including actual source units, neutral missing/stale/ambiguous diamonds and negative-value triangles. The legend remains collapsible, and the responsive drawer retains keyboard list selection, Close/Escape and focus restoration.

| Preset        | WGS84 bbox: west / south / east / north | Basis                                                         |
| ------------- | --------------------------------------- | ------------------------------------------------------------- |
| Greater LA    | -119.05 / 33.35 / -116.70 / 34.60       | Existing parent study envelope                                |
| Coastal LA    | -118.65 / 33.65 / -118.10 / 34.15       | Rounded west/central/coastal urban study window               |
| Inland Empire | -117.85 / 33.75 / -116.70 / 34.35       | Rounded eastern urban/foothill study window within Greater LA |

These are rectangular engineering presets, **not official CARB basin or county boundaries**. No official coverage is implied. All are immutable shared metadata, ordered non-crossing WGS84 bboxes within Greater LA. API sub-bboxes must remain within the selected preset.

A valid pending station ID survives filter loading. Only the active valid response decides whether to reopen the exact identity or clear it with a calm explanation. Selection cleanup replaces the active history entry; earlier valid selections remain recoverable with Back. Errors cannot prove deletion and retain pending IDs. Parameter-specific pollutant identities are never remapped by name or location. Initial/deep-link/popstate URLs canonicalize safe fields; repeated identical filters do nothing. Rapid filter and selection-cleanup patches merge against current state, preventing an old region/pollutant from being restored. The real browser exposed this race during verification; it was fixed and covered by a regression test.

Analyze This Station carries validated opaque station ID, pollutant, mode, region, metric and applicable historical snapshot to `/analysis`. Reload preserves that context. The four-route structure and later-module responsibilities are retained. No chart, multi-station comparison, fire polygon, forecast, export, AI or deployment was added.

## Source and cache behavior

The canonical public pollutant vocabulary remains PM2.5/O3/PM10. The BFF validates the domain vocabulary and separately maps verified AQS parameter strings 88101/44201/81102 to those pollutants. A recognized AQS raw code contradicting its normalized pollutant is rejected; raw code, unit and period remain preserved. The [official EPA parameter table](https://aqs.epa.gov/aqsweb/documents/codetables/parameters.html) supports the bounded mapping. Test-only AQS records are modeled doubles, not acquired official data. This does not introduce an AQS adapter or an AirNow wire codec; unverified AirNow wire codes remain absent.

The three presets share parent Greater LA acquisition/cache keys for a fixed mode/pollutant/metric/time/snapshot. Query clipping occurs after the cached batch load. Response requested-region/bbox metadata differs correctly from original available coverage. Stored snapshots still identify their actual Greater LA batch coverage. No DB, migration, fixture or Docker change is needed. Selection, legend/layer visibility, pan/zoom and unchanged-context page navigation produce no new observation reads. The existing API usage service measures upstream attempts/cache counters without adding map cards.

The unchanged synthetic fixture returns three identities at two coordinate locations in Greater LA, two co-located Alpha identities in Coastal LA, and zero in Inland Empire. Beta (-117.9, 33.9) is outside both smaller presets. These are fixture results, not network coverage. An empty PM10 selection says “No PM10 stations reported in this region and time window.” Latest sample observation remains 2026-01-15T20:00:00Z, shown with PST and UTC in the drawer.

## Files changed

| Files                                                                                                                                                           | Purpose                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/domain.ts`, `bff.ts`                                                                                                                    | Shared preset IDs/metadata, region catalog and requested-response region contract; source snapshots retain parent identity              |
| `apps/api/src/bff/query.ts`, `service.ts`                                                                                                                       | Validate preset/sub-bbox queries; reuse parent cache/acquisition and clip source coordinates                                            |
| `apps/api/src/bff/pollutants.ts`, `normalize.ts`                                                                                                                | Canonical domain validation, bounded AQS parameter mapping and mismatch rejection                                                       |
| `apps/web/src/route-state.ts`, `App.tsx`                                                                                                                        | Canonical region URLs/history and current-state patch merging                                                                           |
| `apps/web/src/use-stations.ts`                                                                                                                                  | Reject wrong region/bbox/snapshot context in addition to existing mode/pollutant/metric checks                                          |
| `apps/web/src/map/MapExplorer.tsx`                                                                                                                              | Region controls/extent, disabled products, active-result selection reconciliation and contextual empty state                            |
| `tests/unit/map-filters.test.ts`                                                                                                                                | Preset/normalization/query/cache/coalescing/historical tests                                                                            |
| `apps/web/src/App.test.tsx`                                                                                                                                     | Region/metric preservation, clearing, deep links, rapid state merges, aborted late responses, wrong context, unit legend and empty PM10 |
| `tests/e2e/foundation.spec.ts`                                                                                                                                  | Actual sample BFF filters, reload/Back/Forward recovery, Analyze handoff and usage/no-passive-request checks                            |
| `README.md`, `AGENTS.md`, `docs/architecture/provider-bff.md`, `docs/frontend/{map-interactions,design-system,arcgis-map,station-observations}.md`, this report | State machine, URL/cache/source semantics, accessible symbols and handoff                                                               |

Map runtime, SDK dependencies, map startup/disposal behavior, DB schema and repository were reused. The installed ArcGIS SDK remains 5.1.27. The current [ArcGIS map component reference](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-map/) was consulted for extent updates, hit testing and destruction; no package upgrade was needed.

## Verification actually executed

| Check                                   | Result                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run lint`                          | **Passed**                                                                                |
| `npm run typecheck`                     | **Passed**                                                                                |
| `npm test`                              | **136 passed / 14 files**                                                                 |
| `npm run build`                         | **Passed**; 5,848 modules; existing large ArcGIS chunk warning applies                    |
| `npm run test:e2e`                      | **7 Chromium tests passed**, isolated ports 5174/3103, no provider/browser token required |
| Real ArcGIS Chromium interaction script | **Passed** using the existing local dev app and its configured public basemap token       |
| DB integration                          | Not rerun: no DB/schema/repository behavior changed                                       |
| Remote CI / other browser engines       | Not executed                                                                              |

Production output: web entry 360.88 kB (111.48 kB gzip), lazy ArcGIS runtime 1,141.08 kB (272.42 kB gzip). The existing >500 kB chunk warning remains; no dependency/SDK change was introduced. `git diff --check` passed, and applied migrations, provider codec, repository, package lock, Docker config and map runtime/lifecycle files remained unchanged.

The first sandboxed Supertest attempt hit `listen EPERM` on loopback; the suite passed when run with the permitted local-listener execution. An initial E2E request-count assertion treated a development reload as one request; the final assertion measures filter reads separately from StrictMode reload cancellation. The real ArcGIS run initially exposed a rapid route-patch race; the successful run followed the current-state merge fix. No test/provider gate was bypassed.

Real ArcGIS measurements from `.local/milestone05/browser-verification.json`:

| Measurement                                                         | Actual value                      |
| ------------------------------------------------------------------- | --------------------------------- |
| Map element / view / station layer reused across six filter updates | **All identical**                 |
| Additional map element insertions during those updates              | **0**                             |
| Final layer count / Coastal LA graphics                             | **2 layers / 2 monitor graphics** |
| PM2.5 selection preserved in Coastal LA                             | **Yes**                           |
| O3 change clears incompatible parameter-specific identity           | **Yes**                           |
| Ozone concentration legend uses supplied ppb                        | **Yes**                           |
| Passive observation requests: legend, visibility, pan/zoom          | **0**                             |
| Extra observation requests on Analyze                               | **0**                             |
| BFF upstream request delta                                          | **0**                             |
| BFF cache-hit delta during verification                             | **6**                             |
| Browser AirNow/AQS/OpenAI requests                                  | **0**                             |
| Unhandled browser errors                                            | **0**                             |
| Analysis reload retains selected station/context                    | **Yes**                           |
| View destroyed on Analysis navigation                               | **Yes**                           |
| 390px horizontal overflow                                           | **None**                          |

Visually inspected real-map artifacts are `.local/milestone05/coastal-ozone-real-1440.png` and `inland-empty-real-390.png`; default E2E also covers 1440/1280/390px without a browser token. Mocked MapCanvas/runtime tests continue to prove mount/update/disposal and co-located hit testing without WebGL. Real tile success establishes availability for this local Chromium run, not offline support, all networks, other engines, token restriction configuration or production hosting. Air-quality values remain synthetic. No authenticated AirNow/AQS/OpenAI query or real official historical acquisition was performed.

## Acceptance and Prompt 06 handoff

| Criterion                                                                | Status                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| A01: Three pollutants/presets, accurate metric symbols                   | **Met**; engineering bbox labels and unit-aware legends                                         |
| A02: URL/drawer synchronization without stale results or view recreation | **Met**; cancellation/current-state merging, reload/history tests and real view identity checks |
| A03: Unsupported products disabled                                       | **Met**; Monitoring Stations only; reporting-area/forecast options disabled                     |
| A04: Valid Analyze state and cache discipline                            | **Met**; actual sample API/browser links, parent-cache coalescing and usage measurements        |
| A05: Four-page responsibilities and quality gates                        | **Met**; all required gates passed; no scope expansion                                          |

Prompt 06 should consume the validated Analysis station/region/pollutant/mode/snapshot context and use the existing bounded full observation endpoint for charts. Preserve source averaging periods, independent units/AQI, missing gaps, UTC/DST and exact parameter-specific identities when adding comparison. Do not infer official station coverage from the synthetic fixture. Live and official historical chart availability still depend on verified acquisition/identified snapshots. Reporting-area/forecast contract work remains Prompt 07.
