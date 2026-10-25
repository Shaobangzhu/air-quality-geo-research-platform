# Prompt 05 — Pollutant Exploration + Linked Interaction

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Map Explorer interaction polish  
**Recommended Codex effort:** Medium–High

## 1. Role and Execution Mode
Act as the senior TypeScript GIS interaction engineer. Inspect the implemented Prompt 01–04 state and current SDK docs. Extend existing components/services; preserve working functionality and map lifecycle. Implement tests; do not merely provide suggestions. Do not commit or push.

## 2. Repository Context
The product is a four-route **local-first** interview PoC; existing Docker PostgreSQL stores bounded snapshots and domain metadata. `/map` owns spatial navigation and station details. `/analysis` owns full time-series and cross-station comparison later (Prompt 06). `/wildfire` owns fire-specific GIS; `/data` owns provenance and export. Do not duplicate these responsibilities. Prompt 04 already implemented stations, selection and Analyze link; validate what is actually present.

## 3. Objective
Make Map Explorer intuitive and scientifically correct when users switch pollutants, region presets, and compatible observation products; preserve selection when possible and provide clean deep links into Analysis. No new pages.

## 4. Scope
1. **Pollutant selector:** PM2.5, O3, PM10 with canonical domain codes and provider code mapping in BFF. Show only supported measurement products. Changing pollutant updates stations/layer/legend and drawer coherently, with request cancellation and no stale-results race.
2. **Region presets:** Greater LA (study bbox -119.05/33.35/-116.70/34.60), Coastal LA and Inland Empire. Define explicit studied bounding boxes and document that they are **engineering presets**, not official CARB basin boundaries. Avoid showing fabricated formal county shapes. Support region-specific map extent and query bounds. Add other regions only if useful, not for visual clutter.
3. **Linked interaction:** station click -> details drawer -> `Analyze This Station` that includes station ID, pollutant, data mode and (if relevant) supported region; direct links to a specific station work on reload. On unsupported/deleted station selection, clear selection and display non-alarming explanation.
4. **Data Product selector:** map current mode to available monitoring-site observations. Other product choices are **not enabled** until Prompt 07 verifies contracts. For unavailable products show a clear disabled state; no inert 'coming soon' selection that claims results.
5. **Renderer consistency:** AQI category colors and bounds for AQI; unit-aware concentration legend for concentration; missing/stale neutral; category color not re-used to imply concentration thresholds. No mixing forecast, reporting area and station without distinct modes.
6. **UX:** compact toolbar only; expand/collapse legend; drawer accessible by keyboard, selection state recoverable; loading/error/empty and 'No PM10 stations reported' handled honestly. No full chart on this page.
7. **Cache discipline:** filters produce canonical BFF request keys; avoid multiple fetches from renderer updates, repeated view creation or pan/zoom. Measure outbound request changes using the Prompt 02 API usage service, but do **not** add Usage cards to `/map`.
8. **Docs:** interaction state machine, URL contract and accessible symbols.

## 5. Technical Requirements
Use strict TypeScript, Zod at BFF boundaries and normalized contracts. Retain UTC for underlying data; show local time with DST. Do not mutate local DB to 'fix' missing provider data. Region preset bbox must be valid and not cross anti-meridian unless explicitly supported. Provider requests remain server-side. Existing sample/historical/live modes stay distinct.

## 6. Implementation Instructions
Inspect map and station services. Define preset metadata, add robust filter/state URL synchronization, refactor only necessary map layer updates, protect against fetch races, implement contextual disabled product choices and responsive drawer/legend, then verify end-to-end Analyze links. Keep controls limited to those in the approved Map Explorer design.

## 7. Testing and Verification
Unit test region bbox and pollutant normalization; UI tests filter changes, selection preservation and clearing, stale requests, appropriate unit-specific legend, missing data, deep linking; integration mock should confirm only the final active filter result is rendered. Playwright: sample mode select a station, change region/pollutant, use Analyze link; check no repeated MapView startup. Run lint, typecheck, tests, build, E2E; report test evidence and limitations of real ArcGIS tile testing.

## 8. Acceptance Criteria
- A01: compact Map Explorer supports PM2.5/O3/PM10 and three documented region presets with scientifically accurate symbology.
- A02: URL and drawer interaction work without stale responses or unnecessary reinitialization.
- A03: unsupported products are disabled or unavailable, not invented.
- A04: Analyze link carries valid state; test coverage demonstrates cache-friendly interactions.
- A05: no functionality was duplicated from Analysis/Wildfire/Data; quality gates pass.

## 9. Out of Scope
No multi-station time-series, long-term meteorological studies, wildfire polygons, smoke forecasts, Reporting Area/Forecast implementation, exports, AI or deployment.

## 10. Final Report
Summarize UX decisions, region coordinates and their engineering basis, state/deep-link handling, cache/request observations, changed files, tests actually executed, acceptance status and Prompt 06 dependencies. **No auto-commit/push.**
