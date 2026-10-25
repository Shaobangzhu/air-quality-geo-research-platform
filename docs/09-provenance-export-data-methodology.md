# Prompt 09 — Research Provenance + Export + Data & Methodology

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Data & Methodology page  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as the senior data-platform/full-stack engineer. Inspect Prompt 01–08 code, PostgreSQL schema, API usage instrumenter, source catalogs, UI shell, and current `/data` placeholder. Implement working datasets/provenance, safe bounded export and measured API usage UI. Do not fabricate usage values or duplicate other pages. Never automatically commit or push.

## 2. Repository Context
**Visual reference:** `references/ui/04-data-methodology.png` (if supplied to Codex) is a *styling/layout mockup only*, not authoritative data or a feature mandate. Follow this prompt for actual scientific data, supported controls, and status.

Four-page local-first V1: Map Explorer (`/map`), Analysis (`/analysis`), Wildfire Case Study (`/wildfire`), Data & Methodology (`/data`). Prompt 02 should track actual BFF HTTP attempts/cache outcomes; Prompt 08 stores curated historical case source metadata. This page is the **single home for data transparency, exports, scientific methodology and API/cache usage**. Approved light blue/white UI includes a source catalog and details panel, preview/export, collapsible methods and compact usage metrics. To avoid overcrowding, use **four internal tabs** with one primary content section visible at once: `Data Sources`, `Data Preview & Export`, `Scientific Methodology`, `API Usage`. These are not four new top-level pages.

## 3. Objective
Create a transparent evidence and operational-inspection page that makes it possible to identify precisely what dataset the app used, export a bounded reproducible subset, review scientific limitations, and see **actual measured** backend provider request/cache statistics since server start.

## 4. Scope
1. **Data Sources tab:** a compact catalog of **actually integrated** AirNow, AQS/AirData (if used), CAL FIRE perimeter, FHSZ and ArcGIS elevation/basemap, plus any other genuinely integrated provider. Each row: provider, product name, type, spatial/temporal coverage if known, original URL, dataset mode/status, acquisition or revision date and source limitations. Clearly separate `connection active` from `data validated` — e.g. AQS is not universally 'preliminary'. Mark unintegrated/unsupported items `Planned` or exclude them; do not claim EPA/CARB feeds are active without evidence. Selecting a row opens one compact details area, not a full second screen.
2. **Data Preview & Export tab:** scoped selectors for dataset, region, pollutant, station and supported date range; a small paginated preview (not an unbounded table); actions `Export CSV` and `Export JSON` for the **actual selected returned dataset** with a sidecar or embedded provenance manifest containing provider, dataset version, query, unit, measurement kind/averaging, dates/time zone, data mode, fetched/indexed timestamp, limitations and export generation timestamp. Prevent data volume exhaustion, export of secrets and CSV formula injection; preserve missing vs 0. Do not invent row counts or release dates.
3. **Scientific Methodology tab:** readable short collapsible sections for `AQI vs Concentration`, `Preliminary vs Validated`, `Monitoring Station vs Reporting Area`, `Forecast vs Observation`, `Timestamp and Time Zone`, `Fire Hazard Severity Zones (FHSZ)`, and `Data Limitations and Missing Data`. Methods must reflect source docs and actual implemented behavior; link to primary documentation and explain no validated source attribution or fire-risk forecast. No full research notes editor.
4. **API Usage tab:** **actual**, not decorative counts from Prompt 02 `GET /api/usage/summary`: total outbound provider HTTP attempts, cache hit rate, successful outbound requests, failed outbound requests, plus compact per-provider table with attempts, cache hits, failures, optional mean latency. Label `Since Server Start`, `lastUpdatedAt`, and process reset behavior. In sample/historical-only mode, provider outbound counts may truthfully be zero. Do not confuse inbound BFF calls, DB reads, retries and cache hits with billable third-party transactions.
5. **ArcGIS caveat:** browser-side basemap/elevation/tile traffic is outside BFF instrumentation; label `ArcGIS (client) — not tracked locally` and optionally link to official Esri usage dashboard. Do not claim billing accuracy or invent billable credit numbers.
6. **Instrumentation robustness:** if Prompt 02 counters are missing/broken, repair centralized middleware/client instrumentation at a small scope. Define outbound attempt counted at actual send, success/failure semantics, retries counted as separate actual attempts, and cache hit rate = hits/(hits+misses) for cache lookups. Ensure request summary does not expose token-bearing URLs. No Prometheus/Grafana/telemetry backend or persistent historical metrics required; bounded in-memory is sufficient and reset is transparent.
7. **Server endpoints:** use existing read-only data source/query APIs; add bounded `/api/exports/...` or safe streamed export service only when needed. The export contract and provenance manifest should be testable and not infer AQS status from AirNow status.
8. **Docs:** source attribution rules, data lineage, CSV/JSON schema and encoding, cache/metric semantics, non-regulatory data disclaimer, documentation source links and limitations.

## 5. Technical Requirements
- All displayed figures are real locally measured counters or test data explicitly tagged sample.
- No client exposure of AirNow/AQS/OpenAI/DB secrets. ArcGIS browser tokens need referrer/privilege restrictions.
- Auth-free PoC still requires bounded input and output; no arbitrary query execution, path traversal or unbounded SQL exports.
- Historical records cannot be labeled validated without knowing source validation status.
- Avoid repeating full station details, map or time-series visualization from other pages.
- DB is local existing Docker PostgreSQL only; do not create cloud billing/monitoring infrastructure.

## 6. Implementation Instructions
Inspect source and usage APIs; select small tab design; build source list + details, preview with paging + export, methodology accordions, and measured API Usage. Wire backend export safely and reuse source manifests from Prompt 08. Ensure changing tab does not trigger avoidable external provider calls; cache/usage only reflect real activity. Update docs and add deterministic tests.

## 7. Testing and Verification
Provider catalog active vs planned/unknown status, missing version, valid source references; export round-trip CSV/JSON with UTC timestamps and nulls, CSV injection hardening, row-limit enforcement, unit metadata, source manifest, safe name; API metric counters after miss/hit/timeout/retry, no false counts in sample mode, resets after process restart, ArcGIS not-tracked note; methods accuracy and no hidden fake data. Playwright `/data` visit four tabs, preview, download/test exported payload, observe known local counters after mock BFF requests. Normal tests/CI require no live keys; run lint/typecheck/unit/integration/build/E2E.

## 8. Acceptance Criteria
- A01: `/data` is useful but uncluttered, with four functional tabs and no duplicate major page features.
- A02: source catalog distinguishes connection, data status, provenance and revision; only actual integration marked active.
- A03: bounded CSV/JSON export includes verifiable records and source/time/unit metadata, no forged numbers.
- A04: API Usage cards and per-provider table display **real since-start measured counts**, cache semantics and ArcGIS-not-tracked disclosure.
- A05: correct scientific guidance, security controls and offline deterministic tests pass.

## 9. Out of Scope
No separate Analytics Dashboard or Settings page, large data lake, persistent user accounts, SaaS billing, Grafana/Prometheus, export to regulatory reports, wildfire simulations, AI assistant, cloud deployment or long-term usage billing history.

## 10. Final Report
List changed files/routes, example **actual** metric output with test/live context, export schema/provenance, UI coverage, data-source verification status, tests run and results, scientific/security limitations, acceptance status and Prompt 10 readiness. Never invent usage statistics. **Do not auto-commit/push.**
