# Greater LA Air Quality Geo Research Platform — All Codex Prompts 01–12 (v2.0)

Repo: https://github.com/Shaobangzhu/air-quality-geo-research-platform

**Local-first:** React/Express + isolated existing Docker PostgreSQL. V1 has exactly four routes. Do not start future AI Prompts 11–12 without an explicit decision.

Four existing UI concept images are bundled under `references/ui/`. Treat these as styling references, not official data. The text requirements take precedence.

For setup, verification sources, acceptance rules, and model-effort recommendations, see `README_CN.md`.


---

# Prompt 01 — Foundation + Provider Capability Validation

**Project:** Greater LA Air Quality Geo Research Platform  
**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 — local-first interview PoC  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as the principal TypeScript architect and scientific-data engineering lead. **Inspect, implement, test, and document real working code** in the existing repository; do not merely propose a plan. Start with `git status`, `README.md`, `.gitignore`, and a directory inspection. This repository was initially created with only README and gitignore, but verify the current state rather than assuming it is still empty. Protect any user changes. Do not commit, push, or delete existing data unless explicitly authorized. If blocked by credentials or local infrastructure, implement safe, deterministic parts and report exactly what remains blocked.

## 2. Repository Context
Public-facing product name: **Greater LA Air Quality Geo Research Platform**. Subtitle: **Interdisciplinary Research & Software Engineering Workbench — v1**. This is a research-oriented GIS/air-quality interview demonstration, not a weather app, regulatory platform, or production scientific model.

**Frozen four-page UI information architecture:** `/map` Map Explorer; `/analysis` Analysis; `/wildfire` Wildfire Case Study; `/data` Data & Methodology. Later prompts implement those pages. No separate home Dashboard, AI, Research Notes, or Settings page in V1.

**Local-first infrastructure:** Run React/Vite and Express locally; persist bounded domain data and curated demo snapshots in an isolated **PostgreSQL database hosted by the user's already-running local Docker infrastructure**. Do not create a new Docker Compose stack, replace a container, wipe a volume, or use a database belonging to another project. Inspect `docker ps`, available configuration and environment *without printing passwords*. If a usable PostgreSQL instance is not clearly identifiable, provide a `DATABASE_URL`-driven setup and explicit instructions; mark database connectivity as unverified rather than guessing credentials. A dedicated database/schema must be used. PostgreSQL is the approved default; PostGIS is optional, not a blocking dependency. Local-first does not promise fully offline ArcGIS basemaps.

Preferred workspace structure:
```
air-quality-geo-research-platform/
  apps/web/                  React + Vite + TypeScript
  apps/api/                  Express + TypeScript
  packages/contracts/        shared Zod contracts
  fixtures/                  clearly synthetic and separately curated historical samples
  db/migrations/             versioned PostgreSQL schema evolution
  docs/architecture/ docs/data-sources/ docs/research/ docs/milestones/
  scripts/ .github/workflows/ AGENTS.md .env.example README.md
```
Use npm workspaces, a currently supported LTS Node.js (prefer Node 24 if compatible), strict TypeScript, Vitest, React Testing Library, Supertest, Playwright, ESLint and Prettier. Choose the simplest reliable DB driver and versioned migration approach (e.g. parameterized `pg` + documented migration runner); avoid Prisma/PostGIS or framework infrastructure solely for appearance.

## 3. Objective
Build a reproducible full-stack foundation, safe local Docker PostgreSQL connectivity, scientific domain types, verified provider capability documentation, a minimal truthful landing shell, deterministic tests, and CI. Do not implement any substantive AirNow provider adapter, station map or chart yet.

## 4. Scope
1. **Workspace:** working npm scripts for `dev`, `typecheck`, `lint`, `test`, `build`, `test:e2e`, `db:status`, `db:migrate` and optional formatting. Make a clean `npm ci` succeed.
2. **Backend:** separate Express app factory from startup; implement `GET /api/health` with service status and safe DB connectivity indicator (do not expose URL/secrets). No network calls at startup. Validate environment configuration with Zod.
3. **Database:** safe, repeatable migrations; no destructive drops/force resets; no privileged DB assumptions; verify an isolated target and create only minimal migration metadata/foundation. Provide a connection status script without revealing credentials. CI may use an ephemeral PostgreSQL service container; local dev must reuse the existing user-managed Docker DB.
4. **Frontend:** render product identity, the four-page information architecture (future page links can be visibly disabled until implemented), honest data-mode status, and a short non-regulatory disclaimer. No fake live AQI values.
5. **Contracts:** WGS84 coordinates and ordered study bbox; Greater LA extent west -119.05/south 33.35/east -116.70/north 34.60 (engineering extent, not an air-basin boundary); pollutant identity PM2.5/O3/PM10; discriminated AQI vs concentration with units; monitoring-site vs reporting-area identity; preliminary/validated/unknown status; observation vs forecast vs contours; UTC time fields (`observedAt`, `fetchedAt`, optionally issued/valid), period meaning, source/provider/provenance, and missing vs zero. Monitoring-site IDs are strings; never force all data products into one schema. Do not reject all small negative raw concentration measurements automatically.
6. **Data modes:** define `live`, `historical`, `sample` as explicit application concepts; `unavailable` is a state, not a fabricated result. Synthetic fixtures must contain fictional site IDs and unmistakable sample labels; distinguish them from official historical snapshots.
7. **Provider capability document** `docs/data-sources/provider-capabilities.md`: AirNow hourly monitoring-site `/aq/data/`, daily monitoring-site `/aq/dailydata/`, current reporting area `/aq/observation/current/racode/`, current geographic lookup `/aq/observation/current/ziplatlong/`, current forecast `/aq/forecast/current/`, historical reporting-area `/aq/observation/historical/state/`, historical forecast `/aq/forecast/historical/`, and retained KML `/KML/PM25/`, `/KML/Ozone/`, `/KML/Combined/`. Note the six replaced legacy APIs scheduled for retirement on 2026-09-30; never implement them. Also document EPA AQS/AirData, CAL FIRE historical fire perimeters, CAL FIRE SRA/LRA FHSZ, and ArcGIS elevation/basemap services. Mark each claim **officially documented**, **detailed contract verified**, **live-tested**, or **unverified**. Do not invent parameter names, response fields, rate limits, or availability.
8. **Scientific method** `docs/research/data-semantics.md`: preliminary AirNow data cannot substitute for validated historical AQS; AQI != concentration; forecasts != observations; official contours != derived surfaces; hazardous wildfire zones != current fire spread or smoke exposure; timestamps, averaging, time zones and DST must be explicit. Internal UTC; display `America/Los_Angeles`.
9. **Security:** server-only `AIRNOW_API_KEY`, optional `AQS_EMAIL`/`AQS_API_KEY`, future `OPENAI_API_KEY`; browser-restricted, least-privilege ArcGIS browser credential may be exposed to the client by design, unlike server credentials. `.env.example` placeholders only. Never commit real env files, DB dumps or source keys. All provider live tests opt-in, e.g. `ALLOW_LIVE_API_TESTS=true`.
10. **Documentation:** concise README, AGENTS.md with architecture and non-destructive development rules, database setup/assumptions, source URLs, troubleshooting and scope roadmap.

Authoritative starting points (check current docs at implementation time): https://docs.airnowapi.org/webservices ; https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf ; https://aqs.epa.gov/aqsweb/documents/data_api.html ; https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/ ; https://developers.arcgis.com/javascript/latest/ .

## 5. Technical Requirements
- No external provider needed for `npm ci`, unit tests, CI, or basic UI startup.
- Preserve raw and normalized measurement semantics, nullable data and provenance without unnecessary abstract frameworks.
- Use parameterized SQL and non-destructive migrations; never inspect or change unrelated project databases.
- Stable shared contract exports resolve in browser, Node and tests.
- `DATA_MODE=sample` must be honest and deterministic, not described as 'live with fallback'.
- ArcGIS SDK may have changed major versions: document a **verified** supported React/npm integration instead of copying deprecated APIs uncritically.

## 6. Implementation Instructions
Inspect current repository and local Docker status; make an implementation plan of no more than 10 bullets; scaffold workspaces; add DB config and migration machinery; establish contracts/fixtures; build minimal frontend/backend; add docs/tests/CI; execute all checks; review git diff for unrelated or generated artifacts. If Docker DB is unknown, do not invent connection success and do not run destructive Docker commands.

## 7. Testing and Verification
Test WGS84 validation, bbox constraints, leading-zero IDs, AQI vs concentration, timestamps, missing vs zero, negative raw value preservation, region selection, fixtures, frontend project identity, Supertest health, safe handling of unavailable DB, repeatable migration in isolated CI PostgreSQL, Playwright startup smoke. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` where available. If remote GitHub Actions has not actually executed, report workflow as **configured, not verified remotely**.

## 8. Acceptance Criteria
- A01: clean install/build/dev work; four intended routes are documented; no invented values.
- A02: isolated Docker PostgreSQL connection/migration succeeds or precise safe blocker is reported; no third-party database was altered.
- A03: scientific contracts and synthetic fixtures pass tests.
- A04: AirNow 2026 migration and each provider's capability/uncertainty are documented with authoritative sources.
- A05: deterministic tests and GitHub Actions quality gate run without API keys.
- A06: secrets excluded; no accidental commits/pushes or speculative architecture.

## 9. Out of Scope
No full station provider BFF, cache implementation, ArcGIS MapView, charts, wildfire visualization, reporting-area forecasts, AI, cloud hosting, new Docker services, large historical ingestion, ML or advanced scientific modeling. These belong to subsequent milestones.

## 10. Final Report
Provide changed files, verified technical decisions, database status (without secrets), source verification matrix, command results PASS/FAIL/NOT RUN, acceptance-criterion status, limitations, blockers and what Prompt 02 may safely assume. State explicitly whether local Docker connectivity and remote CI were actually verified. **Do not commit or push.**


---

# Prompt 02 — Domain Contracts + Provider BFF

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Local-first  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
You are the senior TypeScript API/data engineer. Inspect the **actual** Prompt 01 implementation and its report before editing. Implement working code, migrations, tests and documents; do not merely advise. Preserve unrelated modifications. Never auto-commit or push. If a live provider contract is unverifiable, isolate that uncertainty and implement a tested fixture-backed path rather than fictional live behavior.

## 2. Repository Context
Product: Greater LA Air Quality Geo Research Platform — Interdisciplinary Research & Software Engineering Workbench v1. Local React/Vite frontend, Express BFF, shared Zod contracts and an **existing local Docker PostgreSQL** deployment are the source of truth; **not** a cloud service and **not** a new Docker stack. Prompt 01 should have established migrations, strict domain semantics, sample fixtures, CI and documented AirNow 2026 changes. Verify, repair minimal dependency blockers, then proceed. V1 pages remain `/map`, `/analysis`, `/wildfire`, `/data`; this milestone implements server infrastructure, **not** the pages.

## 3. Objective
Provide a safe, typed, read-only Express data BFF for station observations with one well-verified AirNow adapter, bounded PostgreSQL-backed snapshot metadata, explicit sample/historical/live modes, caching, provider isolation, and backend API-usage metrics. Make every numerical response traceable to a source, timestamp and measurement unit.

## 4. Scope
1. **Contract refinement:** Monitoring station identity `(provider, nativeSiteId, optional monitor/parameter identity)` with strings and no false aggregation of co-located monitors; pollutant, AQI vs concentration discriminated models; sample period/averaging; observation and fetched timestamps; original source agency vs transport provider; `dataStatus`; complete vs partial result state; `dataMode`; geographical bounds, region presets and error envelope.
2. **PostgreSQL schema (versioned, non-destructive):** bounded `data_sources`, `monitoring_sites`, `observations`, `data_snapshots` and import/provenance metadata as justified. Use safe uniqueness keys that do not erase co-located monitor or differing averaging-period observations. Index read patterns. Keep coordinates as numeric WGS84 initially; PostGIS optional only when already available. Make case-specific imports possible without building a huge AirNow mirror. No raw secret/entire authenticated request URLs in DB.
3. **Provider abstraction:** a single application domain service invokes a read-only AirNow HTTP adapter, performs Zod validation at the trust boundary, maps documented payloads to shared contracts, retains raw-field diagnostics safely, and implements retries/timeout with bounded max. Never let frontend consume provider-specific shapes. The retained `/aq/data/` hourly station route is the starting point, **but verify exact URL/query parameters/response schema with current AirNow documentation and optional authorized live key**; do not assume an old SDK example works. If no key, use strict mock/fixture verification and mark live unverified.
4. **Read-only API**, names may refine to existing conventions: `GET /api/regions`, `GET /api/data-products`, `GET /api/stations?region=...&pollutant=...&mode=...`, `GET /api/stations/:id/observations?pollutant=...&measurementType=...&windowHours=...&mode=...`, `GET /api/datasets`, and safe `GET /api/usage/summary`. Validate query/path inputs with Zod; document response contracts and unsupported combinations. Historical data reads only from an identified local snapshot; sample reads synthetic fixtures/samples; live makes eligible provider calls.
5. **Cache and reliability:** bounded memory cache with canonical keys, in-flight request deduplication, explicit TTL and stale status. Derive TTL from official provider cadence and measured system needs; never call engineering TTL an AirNow mandate. Cache behavior must include the data mode, pollutant, region, requested time and measurement kind; avoid duplicate fetch from map zoom/re-render. On provider error, expose an explicit error/stale indicator and never silently substitute sample data while labeling it live.
6. **Usage instrumenter:** centralized outbound HTTP wrapper records provider name, number of attempts, successful and failed attempts, latency totals/aggregates, plus BFF cache hit/miss counters. `GET /api/usage/summary` returns since-process-start values with `startedAt` and precise definitions. For each provider expose requests, successes, failures, cache hits, optional average latency; cache hit rate denominator must be defined. No raw URLs, API keys, IP addresses or user-sensitive data. DB hits and client-side ArcGIS tile requests are **not** outbound AirNow/AQS requests. The browser ArcGIS service usage must be labeled `not tracked locally` until official billing metrics exist.
7. **Documentation:** `docs/architecture/provider-bff.md`, `docs/data-sources/airnow-live-verification.md` with documented vs actually executed verification, `docs/architecture/data-modes.md`, API usage counting definitions, schema/migration instructions and security model. Add safe `.env.example` values without real keys.

Provider background: https://docs.airnowapi.org/webservices ; https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf ; https://docs.airnowapi.org/faq . The six legacy forecast/location/ZIP endpoints were slated for retirement on 2026-09-30 and must not be introduced.

## 5. Technical Requirements
- Express orchestration layer owns all provider access. No AirNow secret in any `VITE_*` variable, bundle or response.
- Parameterized DB queries. No automatic drops, volume removal or cross-project DB changes. Use existing local PostgreSQL connection; keep CI ephemeral DB independent.
- Treat malformed, missing, delayed, empty, 429 and upstream 5xx separately. Hard limits on bbox, dates, page size and upstream fan-out.
- Retain raw negative concentration values if provider permits; distinguish measured zero and unavailable. Strict AQI vs concentration units; station identity stable.
- Make outbound live calls **explicit**, with provider credentials and opt-in flag for smoke tests; normal local browsing in `sample` and `historical` modes must never unexpectedly call AirNow.
- BFF access logs and usage metrics must not leak tokens. Errors must be actionable without containing secrets.

## 6. Implementation Instructions
Inspect prior schemas and DB state; design minimal migration preserving existing rows; add validation and normalized adapters; implement repositories and source metadata; implement resilient AirNow transport, cache and usage instrumentation; expose routes; create synthetic provider responses only when clearly labeled; document source capability assumptions. Do not implement any frontend page beyond minimal route consumers required for contract verification. Run migrations against a project-isolated DB only.

## 7. Testing and Verification
Use Vitest, Supertest and HTTP mocks to cover: Zod reject of invalid bbox/mode/date; station ID containing zeroes/letters; co-located monitors; AQI/concentration differences; partial observations; missing/zero/negative; provider 429/500/timeout; retries; cache key isolation, TTL, dedup and stale responses; sample never triggering live calls; migration repeatability; SQL safety; no key exposure; exact outbound request count on hit/miss/retry; process-start summary. CI must work without any real external keys. Optional `ALLOW_LIVE_API_TESTS=true` with provided key may validate a small read-only query and record response field evidence (sanitized).

## 8. Acceptance Criteria
- A01: full read-only BFF returns **normalized, source-grounded** observations and safe metadata for sample and any verified live mode.
- A02: isolated PostgreSQL tables/migrations and bounded snapshot store work without data loss.
- A03: cache and request coalescing demonstrate reduced actual outbound requests in tests.
- A04: `/api/usage/summary` faithfully distinguishes outgoing attempts from cache hits and uses actual measured counts.
- A05: provider errors and unavailable states are truthful; no hidden sample fallback.
- A06: tests, typecheck, lint, build and CI-equivalent checks pass; live capabilities unverified are explicitly declared.

## 9. Out of Scope
No ArcGIS station map, time-series chart, reporting-area/forecast UI, official KML contours, wildfire case study, historical multi-year collection, scraping, Cloud deployment, AI Agent, vector database or full observability infrastructure. These belong to later prompts.

## 10. Final Report
List files/migrations changed, domain endpoints/contracts, real vs mocked AirNow verification, cache/usage metric definitions, DB verification, tests executed with results, errors/open questions, acceptance status and dependencies for Prompt 03. **Do not auto-commit/push.**


---

# Prompt 03 — Research Dashboard + ArcGIS Shell

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Map Explorer foundation and shared design system  
**Recommended Codex effort:** Medium–High

## 1. Role and Execution Mode
Act as a senior React/TypeScript and ArcGIS UI engineer. Examine the actual repository, current SDK version, BFF contracts, and existing styling before implementation. Build, test and document functional UI; preserve user work. Do not commit or push. Never fabricate live monitoring measurements or pretend a generated design mockup is verified data.

## 2. Repository Context
**Visual reference:** `references/ui/01-map-explorer.png` (if supplied to Codex) is a *styling/layout mockup only*, not authoritative data or a feature mandate. Follow this prompt for actual scientific data, supported controls, and status.

Product name: **Greater LA Air Quality Geo Research Platform**. Subtitle: **Interdisciplinary Research & Software Engineering Workbench — v1**. Four fixed top-level routes: `/map` Map Explorer, `/analysis` Analysis, `/wildfire` Wildfire Case Study, `/data` Data & Methodology. The approved visual direction from the design concepts is a light, professional desktop research workbench: white/light blue background, restrained cobalt-blue primary actions, rounded panels, generous map canvas, compact toolbar and legible sans-serif type. **One page, one function**, no extra dashboard, notes, Settings or AI navigation. Vite/React and Express BFF are local-first; Docker PostgreSQL is already managed by the user.

## 3. Objective
Establish the shared responsive application shell, navigation, data-status vocabulary, functional Map Explorer layout, and a persistent ArcGIS 2D map lifecycle. Show only data that actually exists in the BFF or explicitly tagged sample fixtures. Other three routes can have clear, non-interactive, truthful milestone placeholders until implemented.

## 4. Scope
1. **Design tokens:** colors, typography, spacing, radii, focus/hover states, loading/error/empty patterns, consistent header/buttons/selects/cards. Reusable components should be small and avoid a big third-party UI library if not necessary. Keyboard accessibility and reasonable 1280–1440px desktop layout.
2. **Global header:** mountain/map brand icon, product name, subtitle, four navigation links with current route highlighted, and a truthful `Live`, `Historical`, `Sample`, or `Unavailable` mode/status label. These labels must represent actual selected data, not decoration. No global search, date or pollutant selectors; filters live only on their owning page.
3. **Map Explorer `/map`:** compact toolbar with `Region`, `Pollutant`, `Data Product`; large center ArcGIS map; collapsible map Layers & Legend overlay; station-details right drawer **only after selection**; a brief preliminary data disclaimer. No full trend chart on map. If station data is not yet implemented, label the map as an empty shell or clearly synthetic data.
4. **ArcGIS SDK integration:** install a **supported** current npm SDK and determine whether map web components or direct MapView are appropriate at the installed version. Avoid copying incompatible 4.x examples into a 5.x SDK. Maintain one stable map/view per mount, update layers and extent reactively, clean up on unmount and avoid duplicate event listeners. Support WGS84 region bounds and a safe base map. Browser ArcGIS API key must be least-privilege, referrer-restricted and explicitly recognized as public-facing; AirNow/AQS/OpenAI/DB credentials remain server-only.
5. **Page routing:** preserve selected `region`, `pollutant`, optionally station/mode through validated search parameters; provide safe defaults on invalid/deep-linked values. Links should work, and unavailable future page functionality should be labeled, not rendered as dead clickable controls.
6. **Graceful local-first behavior:** if ArcGIS tiles cannot load or ArcGIS key is absent, show a non-crashing, honest map-unavailable state and allow rest of shell to function. Local-first does not promise offline tile maps. No unbounded external calls from view changes.
7. **Docs:** frontend design system, route responsibilities, SDK version/auth configuration, basemap availability constraints and supported viewport sizes.

## 5. Technical Requirements
- Do not create multiple ArcGIS map instances when switching pollutant/region or opening a drawer.
- Avoid leaking client secrets; ArcGIS browser token can appear in client by design but must be restricted.
- Shared URL state should not serialize large environmental datasets.
- Respect measurement and source labels: AQI category colors apply only to AQI, concentration needs its own legend and unit.
- No chart duplication or source-provenance table here; those belong to `/analysis` and `/data`.

## 6. Implementation Instructions
Review current package versions and official https://developers.arcgis.com/javascript/latest/ docs. Implement design tokens and routing, Map Explorer toolbar/overlay/drawer layout, persistent ArcGIS view, error/status handling, safe BFF integration with existing contracts, route smoke components, docs, then tests. Make controls whose behavior is not yet implemented visibly disabled with an explanation instead of fake interactions. Keep the scope small and match existing concept-screen visual hierarchy rather than pixel-copying its synthetic data.

## 7. Testing and Verification
React Testing Library: header navigation, active page, keyboard navigation, data mode, validated URL params, empty/error map state, layer legend toggles when available, drawer visibility. Stub ArcGIS SDK in unit tests, test view setup/update/dispose behavior without external tiles. Playwright smoke test at `/map` with sample mode, page heading/toolbar, no network to AirNow required. Run lint, typecheck, unit tests, build and E2E. Manual review at 1440x900 and 1280 widths; check no overflow and no inaccessible color-only status.

## 8. Acceptance Criteria
- A01: recognizable shared UI matches approved four-page visual language, with no fifth page.
- A02: persistent ArcGIS map initializes if credentials/network available; unavailable map gracefully degrades otherwise.
- A03: Map Explorer layout includes three compact filters, map canvas, collapsible legend and conditional details drawer; no duplicate full charts.
- A04: navigation and validated deep links function.
- A05: unit/E2E tests and build pass using deterministic mocks; no invented live data or visible secrets.

## 9. Out of Scope
Real monitoring station layers/adapters beyond Prompt 02, data-driven symbol styling, pollutant linked analysis, historical time-series, wildfire study, CSV export, API usage UI, 3D SceneView, forecasts, AI, cloud deploy.

## 10. Final Report
Summarize changed files, screenshots if capture is supported, SDK/version decision, route design, key/token safety, commands run and results, browser/UI limitations, acceptance status, and dependencies for Prompt 04. **No commit or push.**


---

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


---

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


---

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


---

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


---

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


---

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


---

# Prompt 10 — Final PoC Audit + Interview Freeze

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Freeze candidate  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as independent principal software engineer, GIS QA lead and scientific-data reviewer. Audit the **actual** repository and milestone outputs; fix scoped defects, tests, docs and clearly identified blockers. Do not introduce whole new features. Examine source code and run commands, not merely read prior Codex success summaries. Preserve unrelated changes, and **do not commit or push** unless requested.

## 2. Repository Context
**Greater LA Air Quality Geo Research Platform** — **Interdisciplinary Research & Software Engineering Workbench — v1**. Local-first React/Vite + Express + TypeScript + Zod, user-managed existing Docker PostgreSQL; cloud infrastructure, separate Python services, LLM and advanced source attribution deliberately excluded. Four top-level pages: `/map` Map Explorer, `/analysis` Analysis, `/wildfire` one curated 2025 Eaton Fire Case Study, `/data` Data & Methodology including measured API usage. Initial v1 is a **4–5 minute technical interview demonstration**, not an authoritative regulatory/scientific product. Original prompts 01–09 should have built this progressively; verify real state rather than assuming completion. Prompts 11–12 are **future AI Extension Track** and are NOT dependencies for this freeze.

## 3. Objective
Produce an honestly verified and visually cohesive V1 release candidate, reliable local demo startup with repeatable source-labeled data, solid security/science/test quality and an interview-ready README/demo guide. Freeze only if core acceptance criteria pass; report blockers rather than papering over failures.

## 4. Scope
1. **Repository audit:** source tree cleanliness, package-lock reproducibility, correct environment docs, Node/npm version, npm workspaces, strict TS, Zod at provider boundaries, DB schema/migration safety, no accidental generated bundles or secrets. Check `git diff`, status and dependency audit, prioritize material problems over cosmetic ones.
2. **Local-first readiness:** one-command or concise documented startup using React + Express and existing Docker PostgreSQL. Verify `DATABASE_URL` target isolation, additive migrations, project-only seeds; never reset existing volumes. No production cloud deployment required. `db:seed:sample` and `db:seed:historical-case` must be safe/idempotent and clearly distinguish synthetic from sourced data. Show keyless deterministic demo where possible; ArcGIS remote tiles may still require internet/token, with graceful fallback.
3. **Four-page UI freeze:** Map (compact three selectors, 2D station map, conditional detail drawer); Analysis (one full time-series, up to 3 stations, 24/48/72h, null gaps, summary); Wildfire (one dated historical case, fire perimeter, FHSZ, terrain, limited timeline; optional 3D if real and verified); Data (four internal tabs: source catalog, preview/export, methodology, API usage). No fifth Dashboard, Research Notes, AI Assistant, Settings or duplicated charts. Check 1440px/1280px desktop readability, keyboard/focus, WCAG-related accessible names, error/empty/loading, proper map lifecycle and stateful deep links.
4. **Scientific audit:** AirNow preliminary != AQS vetted data; historical status evidence; AQI != concentration; station != reporting area; forecast != observation; UTC time and DST; measurement/averaging and units; missing != zero; negative raw values handling; FHSZ hazard != real-time risk; historically correct Eaton 2025 incident/study window; archived/final perimeter != hourly fire progression; 2025 LRA map releases might post-date January 2025; no false smoke/traffic source attribution. Verify citations and source URLs. Correct any scientifically misleading UI generated from mockups.
5. **Provider and API usage audit:** verify only current AirNow services (2026 changes); documented/live-tested distinction; cache TTL, stale data, dedup, rate limits, no fan-out storms; in-memory usage metrics count actual outbound attempts and cache hits, label `Since Server Start`, separate ArcGIS browser traffic from BFF metrics and do not advertise billing accuracy. API secrets never in client, logs, README or fixtures.
6. **Data export/lineage:** CSV/JSON against actual bounded datasets with source manifests, provenance and safe escaping; data source catalog `active` status backed by integration evidence. Local stored historical snapshots do not get silently refreshed or recast as Live.
7. **Test suite/CI:** review existing tests for meaningful coverage, remove brittle implementation-specific flakiness but never disable a failing gate. Unit/contract/DB integration/Supertest/RTL/Playwright page flows must run with fixtures and ephemeral CI PostgreSQL. External live tests require opt-in and are excluded from CI. Capture command outputs and actual remote CI state separately.
8. **Performance/security:** one persistent ArcGIS view at a time, no hot loops/polling storms, bounded DB queries and exports, key/referrer restrictions, source URL validation, content encoding, safe server errors, no leaked DB credentials. No fake 100% perfect security claims.
9. **Interview materials:** concise recruiter-first README; representative **real** screenshots (if capture available), 1-page architecture (React -> Express -> providers/local PG), a 4–5 minute demo script, example research questions, at least two STAR/BQ engineering stories about provider normalization and quality gates, explicit 'implemented' vs 'planned' features, and limitations. README should be scannable rather than a 40 KB wall of documentation.
10. **Release metadata:** V1 scope/acceptance matrix, known issues, setup tested environment and a local freeze marker/document; do not tag or commit without permission.

## 5. Technical Requirements
- Do not claim a live workflow was exercised when only fixtures ran. Do not label online basemap as available offline.
- Defect fixes should be small and justified; no repo-wide refactor simply to improve aesthetics.
- Source traceability matters more than a polished but inaccurate map.
- Database migration and seed operations must target only this project's local DB. No destructive resets or backup removal.
- Distinguish P0 core from P1 optional. P1 absent (e.g. 3D/contours) is not automatically a V1 blocker if accurately documented; P0 false scientific claims are blockers.

## 6. Implementation Instructions
Inspect branch and code; write prioritized audit checklist; execute clean install and all quality commands; smoke-test each page using deterministic demo mode and local PostgreSQL; verify optional live paths separately only if credentials permit; repair scoped defects; regenerate outdated screenshots/docs if suitable; rerun all failed gates; prepare release/interview docs. Summarize unresolved blockers instead of masking them. Do not develop AI or high-compute research.

## 7. Testing and Verification
Required: clean `npm ci`; `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run db:status` and migration/seed proof against isolated local/CI DB if available. Test all four page happy/empty/error/deep-link flows, filter selection, chart null-gap and time zones, wildfire case data versions, source links, export payload, API usage counter semantics and secrets. Check that CI is actually green remotely before claiming it. Manually inspect viewport behavior/performance; if screenshots cannot be generated, explicitly say so rather than claiming visual QA complete.

## 8. Acceptance Criteria
- A01: four-page V1 meets approved PRD with minimal duplication, reasonable accessibility and responsive layout.
- A02: a fresh local clone has documented, repeatable startup and isolated existing-Docker PostgreSQL integration.
- A03: live/historical/sample/unavailable status, dataset provenance and scientific limitations are truthful.
- A04: one reproducible historical Eaton case is available; 3D and contours are clearly optional.
- A05: actual API usage and cache statistics, source catalog and bounded exports work.
- A06: tests/CI and 4–5 minute demo evidence are documented; no key leaks, invalid endpoints or unrelated destructive operations.
- A07: no Prompt 11/12 feature is required or falsely advertised as complete.

## 9. Out of Scope
No additional pages, data warehouse, full Southern California historical research, Santa Ana transport model, traffic-source apportionment, computational fluid dynamics, Python microservice, LangChain agent, RAG, AWS/Cloudflare production deployment or new Docker orchestration.

## 10. Final Report
Publish a **PASS / PASS WITH FOLLOW-UP / BLOCKED** V1 freeze review with criterion-by-criterion evidence, files changed, executed tests and exact outcomes, local Docker/migration state, security/source/method issues, screenshots/demo artifacts status, optional vs mandatory omissions, and the smallest remaining repair list. Only call it frozen when all P0 gates pass. Do not commit/push or tag.


---

# Prompt 11 — AI Research Agent + Tool Calling

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** **Future AI Research Extension** (not needed for V1 interview freeze)  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
You are a senior TypeScript AI application architect and scientific quality engineer. **Do not start this milestone until the user explicitly selects Prompt 11.** Once selected, inspect the real repository, the V1 freeze/acceptance report, existing scientific contracts, Express domain services and data provenance. Implement working code, tests and docs with strict read-only safety; never auto-commit/push. Verify **current** LangChain.js/OpenAI SDK APIs and avoid deprecated recipes.

## 2. Repository Context
Greater LA Air Quality Geo Research Platform: four-page local-first React+ArcGIS / Express+TypeScript / user-managed Docker PostgreSQL research PoC. AirNow near-real-time observations are preliminary, historical AQS/AirData and curated Eaton fire case are separate. V1 freeze Prompt 10 must remain intact; this is a separate AI Extension Track. There must be **no fifth mandatory top-level AI Assistant page**. Add a compact, optional contextual Research Assistant drawer/panel within Analysis (or Wildfire Case Study where appropriate), with a clear disabled/configuration status when `OPENAI_API_KEY` is absent.

## 3. Objective
Create a **bounded, read-only, evidence-grounded environmental research agent** that orchestrates existing deterministic domain services via LangChain.js and OpenAI, returns a typed response with verified observation/source references, and demonstrates real testing/quality engineering. Do not create a generic unconstrained chatbot.

## 4. Scope
1. **Current framework:** evaluate official https://docs.langchain.com/oss/javascript/langchain/agents and https://docs.langchain.com/oss/javascript/integrations/chat/openai plus current OpenAI model/API docs at execution time. Use supported stable LangChain.js tool APIs, a minimal agent abstraction and Zod. No automatic LangGraph unless task genuinely requires stateful workflow.
2. **Architecture:** Express BFF -> Agent orchestration -> strictly read-only tool wrappers -> **existing** air-quality/domain services -> provider/cache/local PostgreSQL; no direct AirNow/AQS calls from model tools. No Python AI microservice, separate Docker service or duplicate provider adapters.
3. **Question scope:** a small list such as 'Which available stations had highest PM2.5 AQI within this region/time window?', 'Compare selected PM2.5 station observations over the last 12h', 'Which observations are stale/missing?', 'What is the verified reporting-area forecast?' *only when existing services support the specific query*. Unsupported questions must yield `insufficient evidence/unsupported`, not invented results.
4. **Tools** grounded in actual services, e.g. `get_station_observations`, `get_station_time_series`, `compare_selected_stations`, `get_reporting_area_forecast`, `get_data_provenance` **only as implemented**. Every tool has a strict Zod input contract with bounded region/bbox, pollutant, station IDs, max stations, row count and time span. Prevent free-form SQL, arbitrary URL fetching, file writes and code execution.
5. **Deterministic numeric processing:** aggregation, sorting, temporal alignment, unit conversion (only supported explicit conversions), sample size, missingness and average calculations performed in tested TS services. Do not ask an LLM to compute statistics from raw text. Distinguish unweighted station mean from official regional AQI. AirNow concentrations/NowCast AQI are not equivalent.
6. **Typed response schema:** question, short answer, `evidence[]` with stable references to actual tool-returned observations/aggregates, `citations[]` (type `data`, IDs must resolve to returned evidence), units/periods/source/status, limitations, `generatedAt`, partial/insufficient status and optional station IDs for UI highlighting. Prefer rendering numeric facts directly from validated tool data; never trust free-form generated numbers without evidence mapping.
7. **Citation validation:** reject unknown citation IDs, mismatched station/time/metric, or narrative numeric claims that cannot be supported by structured evidence as far as mechanically feasible. If answer cannot be grounded, respond with uncertainty/insufficient evidence instead of 'guessing'. Do not assert hallucination prevention is perfect.
8. **API security/cost:** server-only `OPENAI_API_KEY`, model/config centralized, bounded number of tool calls and iterations, request timeout, max input/output tokens, per-session or IP abuse control when appropriate, logs scrubbed, separate usage/cost estimates if measurable. Agent cannot perform writes, browse arbitrary URLs or follow instructions inside tool results. No model API requests during CI.
9. **UI:** small optional Analysis contextual panel, displays question, grounded answer, citations and limitations, visibly cites data mode (sample/historical/live) and preliminary status. No AI answer should replace existing deterministic charts or methods. Integrate into existing 4-page navigation only.
10. **Docs:** agent tool architecture, safety model, scoped example questions, evidence proof strategy, source limitations, model/cost controls, setup, offline tests and live gated smoke tests.

## 5. Technical Requirements
- Every tool response is untrusted content; no unauthorized write tool or dynamic code execution.
- No phantom station IDs, percentages, AQI, times, sample counts, or provider URLs.
- Work with only existing data and current service capabilities; a small valid subset is better than broad claims.
- Default (no key) leaves all V1 functionality fully operational. API usage page must not miscount OpenAI calls: if instrumented, distinguish LLM outbound from AirNow/AQS.
- Keep V1 local-first and existing PostgreSQL, no Redis/vector DB or cloud app needed.

## 6. Implementation Instructions
Audit completed service capabilities and list supported research intents; select supported LangChain APIs; design narrow Zod tools and deterministic services; implement Express agent endpoint + strict response validation; add compact UI panel with disabled mode and validated citations; install mock model/test harness; update security/methodology docs. Avoid scope creep into document retrieval (Prompt 12).

## 7. Testing and Verification
Use deterministic mock LLM/tool responses; test correct tool selection/args, bounds, unsupported questions, missing/stale values, incompatible units, numerical calculations, no data or invalid citations, tool exceptions, provider unavailable, tool-call loop caps, prompt injection inside tool output, model token limits, API key secrecy, response schema and contextual UI. CI network-free, no paid calls. Optional live tests explicitly gated by `ALLOW_LIVE_LLM_TESTS=true`, log only sanitized results and actual measured token usage. Run all existing V1 tests plus agent-specific tests.

## 8. Acceptance Criteria
- A01: narrow set of meaningful read-only queries work end-to-end using existing services and deterministic calculations.
- A02: every supported numeric answer is attached to **resolvable source evidence**; unsupported data yields insufficient-evidence response.
- A03: no model or provider secret reaches browser, logs or fixture; tool/time/token limits enforced.
- A04: four-page V1 remains unchanged without an OpenAI key; no fifth mandatory page.
- A05: deterministic offline agent tests and all existing CI gates pass; optional live integration evidence clearly labeled.

## 9. Out of Scope
No EPA/CARB document RAG, embeddings/vector search, agent long-term memory, free-form arbitrary browsing, SQL/code execution, autonomous loops, write tools, weather forecasting, regulatory decision making, Python AI service or cloud deployment. Prompt 12 is the separate RAG/evaluation milestone.

## 10. Final Report
Summarize actual tool inventory, SDK and model versions, evidence and citation validation strategy, security/cost ceilings, files changed, tests executed/results, optional live verification, limitations, acceptance status and Prompt 12 prerequisites. No fictional citations or false claims of perfect hallucination prevention. **No commit/push.**


---

# Prompt 12 — Environmental Document RAG + Agent Evaluation

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** **Future AI Research Extension** (requires Prompt 11)  
**Recommended Codex effort:** High / Extra High if available and justified

## 1. Role and Execution Mode
Act as the senior retrieval engineer, LLM evaluation lead and environmental science methods reviewer. **Do not start until the user explicitly selects Prompt 12 and Prompt 11 is accepted.** Inspect current code, citations, document versions, database and installed SDKs before changing anything. Implement and run tests; do not merely design a pipeline. Preserve V1 and user changes; no automatic commit/push.

## 2. Repository Context
Greater LA Air Quality Geo Research Platform is local-first with four V1 pages, an existing local Docker PostgreSQL data store, Express orchestration and a verified Prompt 11 read-only Agent. This milestone extends the existing Agent with **authoritative environmental methodology document retrieval**, not vectorization of structured AirNow observations. It must not change the core v1 freeze. Only a compact optional contextual Research Assistant panel remains; no new mandatory AI navigation page.

## 3. Objective
Integrate reproducible, provenance-preserving **EPA / AirNow / CARB document RAG** with the already implemented deterministic environmental-data tools and a credible evaluation suite for retrieval relevance, citations, grounded claims, scientific limitations and prompt-injection resistance.

## 4. Scope
1. **Curated corpus:** choose a **small verified corpus** of publicly accessible and appropriately reusable EPA AQI/NowCast, AirNow preliminary-data/methodology, EPA AQS/AirData, CARB air-quality monitoring or wildfire methodology docs. Validate original URL and copyright/reuse terms; do not fabricate titles/versions/publication dates. Avoid committing massive copyrighted PDFs or raw crawls. Store metadata and, where permitted, bounded derived excerpts.
2. **Local-first acquisition pipeline:** explicit authorized document fetch or manual import command; validate allowed hosts/types/content size, no arbitrary remote URL import via agent/user query, no SSRF or secret-bearing paths; extract text, chunk with overlap where justified, preserve metadata per chunk (source organization, document ID/title/version, canonical URL, retrieved/indexed date, section/page, chunk ID, checksum). Stable IDs must not shift needlessly on re-index. Show limitations when publisher provides only HTML or document content has parsing loss.
3. **Embeddings and vector retrieval:** inspect local PostgreSQL for `pgvector`. If available and permitted, use **the existing isolated database** for stored embeddings/indexes. If not, choose a small reproducible local file/database-backed cosine retrieval approach without installing or reconfiguring PostgreSQL extensions beyond the user's permissions. Do not add MongoDB, Pinecone, hosted vector stores, new Docker containers or Kubernetes just for a small PoC. Store embedding provider/model/dimension/index version and re-embed only on document change. Production embedding generation optional with `OPENAI_API_KEY`; offline CI uses fixed small vectors/test doubles.
4. **Separate evidence types:** `dataCitation` resolves to actual structured observation/aggregate tool output; `documentCitation` resolves to actual retrieved document chunk with section/page/URL. Keep these typed, distinguish in UI and response schema, validate against tool/retrieval manifests, and never cite a methodology doc as evidence of a particular observed PM2.5 value. Report missing/contradictory/outdated source evidence accurately.
5. **Combined tool workflow:** route numeric questions to deterministic services, concept/method questions to document retrieval, combined questions to both. Example: 'Compare selected regions' (only where existing deterministic services truly support that comparison) 'and explain whether AirNow preliminary results can support regulatory compliance conclusions' -> numeric tool result plus independent EPA document explanation. Never substitute semantic search of embedded observations for calculation of numeric statistics. If region comparison service was not implemented, don't fabricate it.
6. **Answer grounding:** structured response includes answer, data citations, document citations, observed timestamps, source versions, limitations, and insufficient-evidence state. Implement deterministic citation-ID existence and key field checks; define feasible claim-grounding checks and curated evaluation examples. Do not promise perfect hallucination detection.
7. **Agent/UI integration:** extend existing compact Analysis or Wildfire research context panel to show citations differentiated by type, source section, retrieved date and limitations; allow users to open source references. Keep `/data` source catalog aligned with corpus metadata when relevant, but do not add a fifth page or duplicate a complete document library UI.
8. **Evaluation suite:** versioned fixed fixture set with questions, expected tools/retrieval chunks, known numeric evidence, required limitations and unsupported cases. Deterministic assertions for tool choice, valid IDs, units/timestamps, numeric accuracy, retrieval top-k against fixed corpus, injection attempts embedded within docs, source conflicts, unavailable sources, refusal to invent values, stale evidence, and leakage. Optional evaluator-model run behind explicit paid/gated setting, not normal CI. Report metrics with denominators and test-set size; don't present '100% reliable' based on a small suite.
9. **Security/cost:** server-side model and embeddings keys, network and corpus allowlists, prompt injection defense treats retrieved text as untrusted data, bounded source length/embedding and tool tokens, index/prompt versioning, per-request timeouts, cost usage via existing API usage patterns when measurable; no arbitrary uploads or autonomous web browsing.
10. **Docs:** curated corpus manifest, source licensing, preprocessing/chunking, index version, retrieval and citation contracts, scientific limitations, evaluation methodology/coverage and reproducibility commands.

## 5. Technical Requirements
- No false equivalence between AirNow preliminary current data and validated AQS historical data; document retrieval never upgrades the validity of measurements.
- No fabricated regulatory interpretations; distinguish AQI, concentrations, averaging, observation vs forecast, FHSZ hazard vs risk and official vs derived smoke surfaces.
- No raw secret text, private URLs or arbitrary files passed to retrieval; sources are curated/verified.
- No change to existing React/ArcGIS scientific data services or source calculations except minimal integration fixes.
- CI offline and no paid OpenAI embeddings/LLM requests; local data/index artifacts are reproducible and bounded.

## 6. Implementation Instructions
Audit Prompt 11 evidence and agent service; select and verify small public corpus; create source manifest and safe ingestion command; implement metadata-preserving chunking and local retrieval/index; extend agent tool with typed document citations; add claims/citation integrity checks; build deterministic evaluation harness; integrate optional context UI and docs. Verify real model API patterns against official current docs rather than relying on legacy imports. No new infrastructure unless clearly justified.

## 7. Testing and Verification
Document ingestion/format validation, stable IDs, chunk/page metadata, source attribution, deterministic retrieval ranking, no paid CI calls, stale version update, contradictory sources, missing doc, unknown citations, unreferenced numerical claims, tool/data/doc separation, malicious prompt instruction in source text, secret and URL blocking, bounded token/size, reproducible evaluation run and one combined question. Re-run all existing V1 and Prompt 11 tests; verify DB migration and rollback safety in isolated CI DB. Report real evaluation sample size and results, not claims of blanket reliability.

## 8. Acceptance Criteria
- A01: a small authoritative verified corpus is indexed locally with source/version/section provenance.
- A02: document retrieval works and all cited chunk IDs resolve to actual retrieved source material.
- A03: agent combines document explanations with existing deterministic numeric tool results, with separate citation types and honest limitations.
- A04: reproducible offline evaluation covers retrieval, numerical/citation integrity, failure and prompt-injection cases with transparent metrics.
- A05: no key leak, hosted vector-store requirement or V1 regression; optional live calls gated and cost-bounded.

## 9. Out of Scope
No general internet research agent, arbitrary PDFs uploaded by untrusted users, automatic scientific literature review, large vector service or multi-tenant document system, new Python AI microservice, traffic/wildfire source-apportionment model, autonomous actions, regulatory advice or cloud architecture.

## 10. Final Report
Include corpus inventory and reuse proof, chunk/index schema, retrieval/citation examples tied to real test evidence, evaluation cases/results with denominators, injected-document test outcomes, actual vs optional model calls, security/cost limits, test commands and results, acceptance status, limitations and future research opportunities. **Do not commit/push.**
