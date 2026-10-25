# Prompt 07 — Reporting Area AQI + Forecast

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Verified optional data products  
**Recommended Codex effort:** Medium–High

## 1. Role and Execution Mode
You are a scientific-data-aware TypeScript engineer. Inspect completed Prompt 01–06 code and current official AirNow 2026 web-service documentation, then implement only provider capabilities that can be validated. Build/test code; if detailed endpoint contracts are inaccessible and no opt-in live key is present, create a tested adapter boundary with explicit unavailable state rather than inventing a fake live response. Do not commit/push.

## 2. Repository Context
Greater LA Air Quality Geo Research Platform v1: React/ArcGIS, Express BFF, shared Zod, user-managed local Docker PostgreSQL, clear `live`/`historical`/`sample` data modes. Four existing page routes; Map Explorer includes a `Data Product` selector whose Monitoring Stations mode already works. This milestone is an enhancement, not a new page. AirNow retired six legacy ZIP/location web services on 2026-09-30 and introduced replacements in June 2026. Source: https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf and https://docs.airnowapi.org/webservices .

## 3. Objective
Introduce **Reporting Area Current AQI** and **Forecast** as strictly separate, provenance-aware data products in the BFF and, when verified, as lightweight alternative modes in the Map Explorer Data Product selector. Preserve station observations untouched.

## 4. Scope
1. **Validate current provider contracts** before coding. Candidate retained/new service base paths: `/aq/observation/current/racode/`, `/aq/observation/current/ziplatlong/`, `/aq/forecast/current/`, `/aq/observation/historical/state/` and `/aq/forecast/historical/`. Verify full URL, auth, mandatory query parameters, response schema and date handling. Do **not** use retired `/aq/observation/zipCode/current/` or other legacy APIs. Document what is only documentation-verified vs live-tested.
2. **Domain models** distinct from monitoring station observations: ReportingArea identity/code, aggregated current AQI, forecast issuance time and valid date/time window, pollutant, category, reporting agency, source data product, status, fetchedAt. Do not automatically populate stationId or concentration for reporting areas. Forecast != observed; daily forecast != hourly monitor reading.
3. **BFF endpoints:** bounded read-only routes for reporting areas and current forecasts; validate query/region/limits, normalize provider responses, cache appropriate to source update frequency, isolate 429/timeout/missing area. Store only bounded local cached/snapshot data when justified. Do not iterate ZIP codes to mirror an AirNow dataset.
4. **Map Explorer mode:** Data Product selector choices `Monitoring Stations`, `Reporting Area AQI`, `Forecast` only if implemented/available; product-specific legend and details; never overlay official reporting-area AQI as if it were monitor data. For simple spatial representation, use **documented** area centroid/geometry if available. Do not invent area polygons or geographic boundaries. No additional full-page product dashboard.
5. **Data mode:** truthfully label live, locally archived historical and synthetic sample. No app startup network call. Route status and Methodology links clarify observational vs predictive distinctions.
6. **Tests/docs:** provider capability matrix, response contract, caching policy, update cadence, validAt vs observedAt, unavailability and data provenance.

## 5. Technical Requirements
No default assumptions about pollutant support or concentration fields; validate what is returned. Use strict Zod at provider boundary and typed BFF output. Time-zone and averaging correct, forecasts may have dates without precise hours. No false equality between reporting-area maximum AQI and a specific station. Browser never receives provider keys. Rate limiting and bounded cache continue from Prompt 02. A verified inability to access an endpoint is not permission to manufacture data.

## 6. Implementation Instructions
Audit source docs, write a small capability decision table, extend contracts with distinct products, implement the minimum verified adapter(s) and tests, conditionally expose UI modes, update documentation. When an endpoint is blocked by access constraints, preserve an explicit unavailable state and report which acceptance items remain blocked. Do not change chart/analysis or wildfire functionality.

## 7. Testing and Verification
Mock provider payloads for reporting-area and forecasts, errors, missing fields, category mismatches, empty products, issued/valid timestamps, region limits, reporting-area ID identity, separate mode rendering, routing, caching/dedup, secrets. Test product selector cannot mix forecast with observed station layer, sample is labeled, no legacy endpoints. Optional live read-only smoke requests require explicit key and opt-in; CI fully offline. Run standard lint/typecheck/tests/build/E2E.

## 8. Acceptance Criteria
- A01: reporting area and forecast data contracts are separate from monitoring-site observations and fully tested.
- A02: at least one verifiable new product is functional; other product(s) display accurate disabled/unavailable states when blocked.
- A03: current verified API paths are used; no retired calls.
- A04: Map Explorer retains uncluttered toolbar, product-specific legend and source metadata.
- A05: deterministic quality gates pass; detailed live verification statuses are documented rather than fabricated.

## 9. Out of Scope
No independent Forecast page, risk forecasting, machine learning, wildfire simulation, official KML integration (Prompt 08), wide historical backfill, regulatory conclusions, 3D scene, AI or cloud hosting.

## 10. Final Report
Report exact products functional vs unavailable, source documentation and live-test status, paths used, files changed, tests run, known uncertainties, acceptance status and what Prompt 08 can reuse. **No commit/push.**
