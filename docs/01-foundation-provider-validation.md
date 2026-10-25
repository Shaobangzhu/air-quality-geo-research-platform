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
