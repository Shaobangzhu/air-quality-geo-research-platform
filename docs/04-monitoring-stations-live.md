# Prompt 04 — Monitoring Stations + Live Integration

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Map Explorer station features  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as the senior GIS/full-stack engineer. Inspect all current working code, BFF contracts, schemas, provider verification notes, Map Explorer React components and tests. Implement and verify the station layer end to end, without unrelated refactoring. Never commit/push or expose credentials. Explicitly distinguish `verified live`, `stored historical snapshot`, and `synthetic sample` observations.

## 2. Repository Context
Product: Greater LA Air Quality Geo Research Platform, local-first with already-running Docker PostgreSQL, React + ArcGIS Maps SDK frontend, Express + TypeScript BFF, shared Zod contracts. Prompt 02 owns provider adapters, DB and cache; Prompt 03 owns stable map view, global shell and page layout. The only complete feature here is **Map Explorer**; `/analysis` is not yet a full chart page. Preserve the four-page navigation; no extra Dashboard/Settings/AI pages.

## 3. Objective
Map actual available monitoring-site locations and readings in the Greater LA scope, provide accurate selectable station details, and support honest operation in both authorized live and deterministic sample/historical modes.

## 4. Scope
1. **Station service:** query normalized station observations through existing BFF, not directly from AirNow in React. Respect bounded WGS84 region, pollutant, metric, provider status and optional source snapshot. Fetch by meaningful region/pollutant change, not every map pan or render.
2. **Stable identities:** `(provider, stationId, optional monitor/parameter identity)`, retain leading zeroes and letters, avoid name/lat-long-only IDs. De-duplicate same observation in a source-aware manner without mixing monitoring sites and reporting areas, co-located monitors, averaging periods or measurement types.
3. **Map station layer:** create/update one map layer efficiently; symbols represent **AQI categories** only for valid AQI observations. If showing concentration, use an independently labeled concentration renderer and unit. Stale/missing/unknown values need a separate neutral symbol. Keep legend synchronized with selected data and standard accessible contrasts. Ensure one map view lifecycle.
4. **Station details drawer:** only on user selection. Display station name/ID, location, pollutant, AQI (when available), measured concentration and its unit (when available), observation timestamp, averaging period when known, source agency, provider, preliminary/validated/unknown status, and fetched timestamp. Hide unavailable values rather than inventing them. Include a single actionable `Analyze This Station` link to `/analysis?stationId=...&pollutant=...&mode=...`.
5. **Local-first reliability:** sample mode uses explicitly synthetic fixed fixtures and indicates it at map-level and drawer-level. Historical uses source-labeled local PostgreSQL snapshots. Live uses verified provider response only if authorized key exists; if not, show an empty/unavailable explanatory state rather than silently relabeling sample data. Do not use generated UI concept mockup station values.
6. **Geography:** initial Greater LA study extent stays an engineering bbox, not a regulatory boundary. Region clipping and station selection must use source coordinates as WGS84; invalid coords excluded with diagnostics.
7. **Performance:** bounded station counts, single request per meaningful filter change with cache reuse, stable React keys, loading and canceled stale fetch states, cleanup of view handlers. Prefer updating graphics/features in place over destroying map.
8. **Docs:** station identity/dedup semantics, badge/legend design, data-status behavior, live verification constraints and source links.

## 5. Technical Requirements
- No direct AirNow API key/browser traffic. Restricted browser ArcGIS token only for ArcGIS services.
- Validate station coordinates and provider response; no assumed comprehensive station coverage.
- Use explicit timestamps and `America/Los_Angeles` display with correct DST.
- Do not claim a reporting-area observation is a monitor reading.
- Do not interpret missing as zero, and do not silently reject raw small negative concentration values if permitted by source.
- Persist snapshots only through existing dedicated PostgreSQL schema and versioned migrations if truly needed.

## 6. Implementation Instructions
Inspect existing provider contract and actual data availability. Implement/repair only needed station BFF query and repository logic; integrate data into map layer; implement selected-station drawer, responsive map behavior and Analyze link; add status/error/empty cases; update docs; run tests and manually inspect map. Resolve unsupported provider fields with optional or null metadata rather than made-up defaults.

## 7. Testing and Verification
Test normalization with multiple pollutants, leading-zero station ID, near-duplicate monitors, stale data, invalid coordinates, blank AQI, missing concentration, true zero, time offsets; test BFF with Supertest and mocked provider; test station selection, drawer, legend and URL navigation with React Testing Library; Playwright path `/map` select a synthetic clearly tagged station and click Analyze. Assert sample mode never causes upstream AirNow requests and no duplicate requests on passive re-render. `npm run lint`, `typecheck`, `test`, `build`, `test:e2e` must be executed; report actual results.

## 8. Acceptance Criteria
- A01: credible, responsive map of available station observations with stable selection and accurate legend.
- A02: data provenance and preliminary status visible; no fabricated official station identifiers or values.
- A03: live mode works only when actually verified, and sample/historical are clearly separated.
- A04: Analyze link navigates to `/analysis` with validated selection state.
- A05: tests, typecheck/build and sample E2E pass; no redundant MapView recreation or secret exposure.

## 9. Out of Scope
No full time-series graph, region comparisons, forecasting, new historical warehouse, wildfire layers, 3D SceneView, CSV export, Agent, or cloud deployment. Pollutant/region linked workflow refinement is Prompt 05; full analysis chart is Prompt 06.

## 10. Final Report
List changes, actual station counts only if measured and with mode/time, proof of live vs mock, map performance and source limits, executed test commands, acceptance status and Prompt 05 readiness. Never claim remote API verification unless it happened. **No commit/push.**
