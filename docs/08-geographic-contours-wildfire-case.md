# Prompt 08 — Geographic Research + Official Contours + Curated Wildfire Case Study

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Wildfire Case Study page  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as a senior geospatial application engineer and environmental-data methods reviewer. Inspect existing Map Explorer, contracts, PostgreSQL schema, current ArcGIS SDK, provider documentation and exact V1 UI page boundaries. Implement a **small, truthful, impressive historical GIS showcase**, not a smoke prediction engine. Exercise scientific restraint. Do not commit/push or destroy local Docker data.

## 2. Repository Context
**Visual reference:** `references/ui/03-wildfire-case-study.png` (if supplied to Codex) is a *styling/layout mockup only*, not authoritative data or a feature mandate. Follow this prompt for actual scientific data, supported controls, and status.

The four-page V1 must include `/wildfire` as its sole event-specific research page; `/map` owns normal monitoring stations, `/analysis` owns full time-series, `/data` owns provenance/export/metrics. Existing infrastructure: local Express, Docker PostgreSQL, ArcGIS SDK, normalized AirNow observations, explicit sample/live/historical. This Prompt 08 is an **explicit agreed UI-scope realignment** of the original 'Geographic Research + Official Contours' milestone: a curated wildfire study is the **P0 output**, while AirNow official contours are P1 **only if verified and feasible**. No renumbering.

Curated case: **2025 Eaton Fire** (started 2025-01-07), in San Gabriel foothills, Los Angeles County. A specific *study window* must be explicitly chosen based on acquired observations and cannot be mislabeled as the entire incident lifetime. Do not copy invented 2024 dates, fabricated PM2.5 measurements, or inaccurate fire growth animations from design concept images. Official historical CAL FIRE perimeter geometry may be released/updated well after the fire, and should be labeled by dataset release, not depicted as real-time progressive perimeter.

Authoritative sources to verify at implementation:
- https://www.fire.ca.gov/what-we-do/fire-resource-assessment-program/fire-perimeters
- https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/
- https://data.ca.gov/topics/natural-resources-conservation/fire-incidents-history
- https://www.epa.gov/outdoor-air-quality-data
- https://aqs.epa.gov/aqsweb/documents/data_api.html
- https://docs.airnowapi.org/webservices
- https://developers.arcgis.com/javascript/latest/

## 3. Objective
Produce one clickable, source-grounded **Wildfire Case Study** that combines historical fire perimeter, official FHSZ hazard context, monitoring-site observations and terrain. Add a concise event timeline and research context; optionally implement 2D/3D switch and verified official AirNow contour overlays. Prioritize a usable interview demonstration without specialized research compute.

## 4. Scope
1. **Curated case manifest:** create a versioned JSON/Zod schema with event name, documented dates, geographic study bbox, source manifests, `retrievedAt`, actual dataset issue/release date, original URL, checksum where downloaded, limitations, and event/study-window distinction. One case only (`eaton-fire-2025`). Do not invent incident stats. Use legally reusable public data and source-attribution rules. Small curated local snapshots (bounded WGS84 GeoJSON/observations) are acceptable; do not commit huge official downloads or confidential service tokens.
2. **Historical air quality:** obtain bounded documented EPA AQS/AirData observations or other verifiable historical sources for the study dates. An AQS email+key is optional if pre-generated public hourly AirData files suffice. Remember AQS data are delayed/validated on a different cadence than AirNow. Only import real rows with original station/monitor identities, pollutant, unit, averaging, timestamps, source-status, revision. Seed historical local PostgreSQL with idempotent **non-destructive** scripts and traceable snapshot metadata. A separately labeled synthetic sample case may support deterministic CI but must never masquerade as historical observations.
3. **Fire perimeter layer:** use official versioned CAL FIRE/FRAP historical perimeter polygons for Eaton Fire when available; present as `Historical / final perimeter from [dataset version]`, not the fire extent at every hour. Bound query and preserve polygon geometry/projection and attribution. If authoritative perimeter unavailable, mark blocker and do not draw a fictional official perimeter.
4. **FHSZ layer:** source official CAL FIRE/OSFM **State Responsibility Area (SRA)** and applicable **Local Responsibility Area (LRA)** maps. Use Moderate / High / Very High classifications with clear distinction of jurisdiction/status. SRA maps effective Apr 2024; some LRA maps were released in phases during 2025, **after** Eaton ignited; do not present a 2025 LRA dataset as if it were necessarily effective on Jan 7, 2025. FHSZ measures *long-term hazard*, not immediate fire activity, smoke, evacuation status or community damage risk. Unmapped is not automatically Low. Popup: category, SRA/LRA, official source, release/effective date, hazard-not-risk disclaimer.
5. **Terrain:** ArcGIS basemap/elevation context in existing map; 3D SceneView or currently supported SDK equivalent is an optional P1 enhancement. Maintain stable view lifecycle, one view per mode; dispose safely. Terrain must not be presented as a validated 3D smoke simulation.
6. **UI at `/wildfire`:** compact case header with `2025 Eaton Fire`; main map with collapsible layer toggles and legend; concise Case Context panel (verified dates, location/source, two or three carefully framed observations); selected FHSZ or monitored-site contextual detail (not a second full station drawer); small event timeline with only actually supported before/during/after data. If no post-event verified data, label a later checkpoint rather than falsely calling it post-fire. Link to `/data` for methods and source references. Avoid KPI overload, charts and AI widgets.
7. **Optional P1 AirNow official contours:** verify retained KML `/KML/PM25/`, `/KML/Ozone/`, `/KML/Combined/` endpoints and time availability. Import/overlay only with accurate `Official AirNow AQI Contour` legend, timestamp and citation, never conflate it with a concentration heatmap or a researcher-interpolated surface. If KML cannot be reliably consumed, record feasibility findings and leave the toggle unavailable; do not risk P0 case stability.
8. **Optional P1 smoke/wind:** only if real compatible historical NOAA/CARB products are independently verified. Clearly distinguish satellite plume extent vs predicted surface smoke vs measured PM2.5. No invented plume trajectory.
9. **Local-first demo:** case and relevant small public-data snapshots should remain inspectable without re-fetching external APIs on every launch; remote basemap may need network. Dedicated PostgreSQL project schema only; idempotent bounded import, `db:seed:historical-case` with explicit target and source manifest. When historical data is not yet obtained, show a BLOCKED case instead of pretending full P0 complete.

## 5. Technical Requirements
- Numerical claims must trace to exact source dataset/monitor/time; terrain and hazard overlay do not prove causation.
- FHSZ and perimeter versioning explicit; never claim same-year maps represent the as-of historical date without proof.
- No unauthorized source scraping or secret-bearing full URLs; validate geometry and metadata; control feature load/performance.
- Avoid naming arbitrary elevation shading as real plume or risk scores.
- Use existing BFF and normalized contracts; do not duplicate AirNow/AQS providers or overwrite live data with snapshot.
- Represent unavailable official contours/3D honestly; no unsupported map options or phantom overlays.

## 6. Implementation Instructions
Inspect existing contracts/UI. Produce a one-page source feasibility log; validate event and public dataset version; implement manifest, bounded historical import/migrations, case BFF route and UI (2D P0), FHSZ and terrain map layers, timeline and context, citations. Add P1 features only after P0 is truthful and tested. Document study dates and observed air quality coverage. Do not add any new top-level route other than `/wildfire`.

## 7. Testing and Verification
Test official event ID/date and release provenance, station-time dataset imports, idempotent seed, source checksums where applicable, CAL FIRE geometry validation, SRAs vs LRAs classifications, unreleased-as-of-event warning, FHSZ hazard-not-risk notice, unmapped != low, missing observations, 2D map layers and toggles, event timeline labels, disabled P1, mode isolation, secret protection. Mock ArcGIS/remote services for CI, run Playwright `/wildfire` with correctly labeled historical or explicitly synthetic sample dataset. Test remote basemap failure gracefully. Run lint/typecheck/tests/build/e2e plus manual GIS layer check if real credentials available.

## 8. Acceptance Criteria
- A01: `/wildfire` shows **one verified Eaton Fire historical case**, correct date metadata and bounded source provenance, or a precisely documented critical blocker (not false PASS).
- A02: fire perimeter and FHSZ are official and explicitly versioned; valid `Moderate/High/Very High` legend and SRA/LRA semantics.
- A03: terrain and monitoring station context work; no fabricated smoke or numerical findings.
- A04: timeline reflects real temporal coverage, no false progressive-perimeter animation.
- A05: local snapshot seed is repeatable; 2D demo and CI/E2E pass without paid provider calls; optional 3D/contours cannot hide P0 failures.

## 9. Out of Scope
No Santa Ana model, multi-fire search, wildfire nowcasting, fire suppression/evacuation alerts, complex 3D plume simulation, traffic/tires/emissions causal attribution, source-apportionment models, automatic fire segmentation, AI Agent, PostGIS requirement, high-compute scientific service or cloud deploy.

## 10. Final Report
List source links and versions, actual case dates and monitoring coverage, data imported/where stored, screenshot or functional UI description, what was verified vs sample, P0 vs P1 status, executed test commands and failures, exact scientific caveats, and readiness for Prompt 09. **Do not commit/push.**
