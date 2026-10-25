# Prompt 06 — Recent-Hour Time Series

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Analysis page  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as a senior full-stack TypeScript engineer with environmental time-series and quality-engineering expertise. Inspect Prompt 01–05 outputs, real schemas, database/query behavior, and front-end routing before implementing. Produce actual tested code and docs. Preserve user changes, never commit/push, and never manufacture missing environmental observations.

## 2. Repository Context
**Visual reference:** `references/ui/02-analysis.png` (if supplied to Codex) is a *styling/layout mockup only*, not authoritative data or a feature mandate. Follow this prompt for actual scientific data, supported controls, and status.

Local-first React/Express app with user-managed Docker PostgreSQL, normalized AirNow near-real-time data, cached BFF and explicit data modes. `/analysis` is the **sole full time-series page**; `/map` provides station selection and a jump link. Remaining routes are `/wildfire` and `/data`. Initial visual inspiration: light research UI with a large single chart, compact filter toolbar and slim right summary/station selection sidebar. Do not copy potentially fictional numbers from image mockups.

## 3. Objective
Implement a reliable Analysis page showing up to three monitoring-station time series over a valid recent observation window, with strict measurement semantics, missing-data visibility, local time display, and clear source quality status.

## 4. Scope
1. **Analysis controls:** selected primary station, pollutant PM2.5/O3/PM10, measurement type `AQI` or `concentration`, window `24h`/`48h`/`72h`. All controls must be tied to verified available data and be URL-deep-linkable. No 7d/30d options unless the backend genuinely supports them; do not render controls from the earlier mockup as empty promises.
2. **Station comparison:** up to three monitoring stations, with one consistent measurement kind and compatible units/averaging interpretation per chart. If incomparable, disable comparison with plain explanation. Primary station must be preserved when linked from Map Explorer. Use distinct accessible line styles/colors.
3. **BFF query:** read from sample fixtures, bounded local historical snapshots or authorized AirNow hourly service through the existing adapter; return a typed series with `observedAt`, measurement kind/value/unit, averaging period, source, status, fetchedAt and explicit missing time slots. Keep provider rate/caching rules and do not fan out many requests per point.
4. **Time semantics:** UTC transport/storage; `America/Los_Angeles` display, including DST transitions. A provider's GMT offset is not an automatic DST timezone. Respect whether timestamps mark interval start/end and explain assumptions. Null/missing records are gaps; never zero-fill or interpolate. Avoid inadvertent duplicate hours at DST fallback.
5. **Main chart:** lightweight well-supported library (choose based on actual requirements); hover/click tooltip with station, observation local/UTC timestamp, value and unit, status; axis label includes measurement and unit; no mixed AQI + concentration on one axis. Missing observations break lines.
6. **Summary panel:** selected station identity and concise derived values for the selected window: min–max of actual comparable observations, available count, missing count; optional peak time if unambiguous. Display calculation method. No redundant big Map or large source table here.
7. **Observation Notes:** concise contextual caveats (preliminary data, gaps, AQI vs concentration) and a `View Data & Methodology` link, not a duplicate methods essay.
8. **Local-first and modes:** standalone sample fixture supports offline deterministic E2E; historical snapshot must be labeled with acquisition date; Live is only real external data. No hidden live->sample fallback; if data unavailable show clear state.
9. **Docs:** time bucketing and averaging semantics, measurement comparability, counting missing observations, chart sourcing, source/reference links and limits on window size.

## 5. Technical Requirements
- No fabricated hourly samples in live/historical modes. A chart with fewer than requested points is valid and must show actual coverage.
- Prevent chart assumptions that data are continuously sampled, equally averaged or validated when not proven.
- Scaled number of read queries with server-side bounds, indexed DB access and in-flight dedup; no API request on each mouse hover.
- State and secrets isolated; no direct AirNow calls in browser.
- Selection, keyboard access, non-color-only differentiators and graceful empty/error handling.

## 6. Implementation Instructions
Inspect actual BFF endpoints and data coverage; implement minimal typed series aggregation (without statistical invention), period alignment, missing and DST utilities with tests, route and chart, station comparison, summary and method link. Match approved Analysis screenshot structure but correct its unsupported period controls and synthetic data. Update BFF/source docs if a real provider constraint blocks a measurement type; expose `unavailable` rather than silently changing units.

## 7. Testing and Verification
Tests: DST spring-forward/fall-back, UTC/local conversions, interval boundary meaning, missing vs zero, AQI vs concentration, inconsistent unit and averaging period rejection, 1–3 station cap, no invented interpolated values, timeline length and sample count, backend query bounds, provider failure. UI tests for controls, tooltip, legend, summary, primary station deep link; Playwright sample scenario Map -> Analyze -> 72h chart -> Data link. Verify chart actually breaks on missing data and CI needs no API key. Run lint/typecheck/test/build/e2e and document all results.

## 8. Acceptance Criteria
- A01: fully usable Analysis page with supported 24/48/72h data and maximum three stations.
- A02: every plotted number is a real available observation or explicitly labeled synthetic sample; unit/time/source semantics are preserved.
- A03: missing values display as gaps, DST is correct and comparisons block incompatible measurements.
- A04: page consumes Map selection and links to Data without duplicated map or methods sections.
- A05: deterministic tests, DB/BFF contract checks, Playwright and builds pass.

## 9. Out of Scope
No annual/long-term trend or research regression, forecasting, multi-pollutant dual axes, wildfire scene, database-wide aggregation, ML interpolation, AI interpretation, billing UI, new DB infrastructure or cloud hosting.

## 10. Final Report
Report data assumptions, sample vs live/historical proof, aggregation and missing-value semantics, changed files, tests run, UI verification, acceptance results, known limitations and Prompt 07 readiness. Do not invent passing test counts. **No commit/push.**
