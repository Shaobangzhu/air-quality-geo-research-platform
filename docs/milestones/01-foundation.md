# Prompt 01 — implementation and verification

Date: **2026-10-25**. Scope: foundation only. No commits or pushes were made. Original numbered prompt documents are unchanged. The four supplied Downloads PNG paths did not exist; this milestone does not depend on them or claim visual fidelity to unseen designs.

## Delivered and verified decisions

- Node 24 LTS (local v24.19.0), npm 11.17.0, workspaces and lockfile. Installed React 19.3.1, Vite 8.3.5, Vitest 5.0.5, TypeScript 5.9.3, Express 5.3.0, Zod 4.6.7, pg 8.23.1 and supported ESLint 10.13.0. Clean install reported zero known dependency vulnerabilities at execution time.
- Built shared ESM/declaration exports resolve in browser, tests and Node. Strict type checking covers apps, tests and scripts. No provider credentials are needed for local verification.
- Express app factory is separate from startup. Startup makes no provider or DB query. Health reports API liveness, configured mode, explicitly unavailable air-quality data, and redacted DB status.
- Four responsive route shells, product identity, disclaimer and source/mode limitations. No fabricated AQI values, map or charts. Desktop (1440px) and mobile (390px) screenshots were visually reviewed; mobile smoke also checks no horizontal overflow.
- WGS84/ordered extent validation, string IDs, AQI/concentration discrimination and units, raw negatives, missing/zero distinction, UTC, period meaning, separate site/area observations, forecasts and contour metadata. Synthetic fixture labeling/provenance is enforced. No official historical sample has been acquired.
- Guarded local PostgreSQL targets, ownership confirmation, dedicated schema, transactional/advisory-locked checksummed migration runner. Unmarked schema adoption rolls back in the unit test. Actual PostgreSQL SQL execution remains unverified locally.

## Command results

| Command / check                        | Result               | Evidence / limit                                                                          |
| -------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `npm ci`                               | **PASS**             | Clean reinstall from lockfile; no provider keys                                           |
| `npm run lint`                         | **PASS**             | ESLint + Prettier                                                                         |
| `npm run typecheck`                    | **PASS**             | Contracts, both apps, scripts and tests                                                   |
| `npm test`                             | **PASS**             | 36 tests in 4 files; Supertest required local socket permission                           |
| `npm run build`                        | **PASS**             | Shared declarations/ESM, compiled API, Vite production web                                |
| `npm run test:e2e`                     | **PASS**             | 2 Chromium tests: local services/navigation/no provider requests; mobile layout           |
| `npm run dev`                          | **PASS**             | All three processes started; API/Vite reachable; contracts watch clean                    |
| Compiled API startup                   | **PASS**             | Built Node service probed on an alternate loopback port without provider/DB configuration |
| `docker ps`                            | **PASS**             | Read-only inspection; only MongoDB running                                                |
| `npm run db:status`                    | **FAIL — no target** | Expected exit 1, `Database: not-configured`; safe missing-config path verified            |
| `npm run db:migrate`                   | **FAIL — no target** | Expected exit 1 with redacted guidance; no connection or SQL execution                    |
| `npm run test:db`                      | **NOT RUN**          | No confirmed PostgreSQL test database                                                     |
| Actual repeatable PostgreSQL migration | **NOT RUN**          | CI integration is configured; no local PostgreSQL exists to verify it                     |
| Provider live tests                    | **NOT RUN**          | No adapters/live tests; opt-in policy only                                                |
| GitHub Actions                         | **NOT RUN remotely** | Workflow configured with ephemeral PostgreSQL and all quality gates                       |
| `git diff --check` / artifact review   | **PASS**             | Existing prompt docs unchanged; generated output, env files and dumps excluded            |

Early verification failures were corrected before final checks: a frontend selector matched both the brand and navigation; Supertest needed sandbox loopback permission. One command overlapped the clean reinstall and was discarded/rerun after install. The DB tool launcher was changed to `node --import tsx` to avoid unnecessary CLI IPC restrictions. These do not change the final results above.

## Database status and safe blocker

**Docker inspection was actually verified. Local Docker PostgreSQL connectivity was not.** No PostgreSQL instance, repository connection configuration or relevant process-environment credentials were identified. Only presence/absence of relevant environment fields was checked; values were not printed. No unrelated database was queried, no credentials guessed, no new container/Compose stack created, and no existing data changed.

The missing dependency is an infrastructure-owner-provided dedicated `air_quality_geo_research` database/role and published loopback connection details, plus a separate test DB for integration. [Database setup](../architecture/database.md) documents permissions, target confirmation, migration behavior and troubleshooting.

## Source verification matrix

Full claims, dates, limitations and authoritative URLs: [provider-capabilities.md](../data-sources/provider-capabilities.md).

| Provider                                                                                                                   | Verified evidence level                                                                                                                      | Still unverified                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AirNow hourly/daily sites, current geographic/area observations, forecasts, historical areas/forecasts, three KML products | **Officially documented**, including 2026 replacement/retained paths and the six legacy retirement notices                                   | Detailed per-route request/response contracts, credentials, live availability, numeric quotas and retention |
| EPA AQS/AirData                                                                                                            | **Officially documented**; selected AQS request-variable/geographic-selection details **detailed contract verified**                         | Full response normalization, acquired snapshots, record quality and live behavior                           |
| CAL FIRE historical perimeters and SRA/LRA FHSZ                                                                            | **Officially documented** capabilities and scientific limitations                                                                            | Dataset/layer contracts, exact item release, adoption context and live access                               |
| ArcGIS basemaps/elevation                                                                                                  | **Officially documented**                                                                                                                    | Account/service/layer entitlements and live behavior                                                        |
| ArcGIS React/npm                                                                                                           | **Detailed contract verified for integration guide**; 5.1 release direction documented; core/map-components 5.1.27 registry versions checked | SDK runtime integration (intentionally not installed yet)                                                   |

No provider is labeled live-tested. Internal schemas are not claims about external field names. The AirNow retirement date is the documented schedule; actual shutdown was not tested.

## Acceptance criteria

| Criterion                                                   | Status                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| A01 reproducible install/build/dev and four routes          | **PASS**                                                            |
| A02 isolated PostgreSQL or precise safe blocker             | **PASS via documented blocker**; connectivity/migrations unverified |
| A03 scientific contracts and synthetic fixtures             | **PASS**                                                            |
| A04 provider capability/uncertainty and 2026 migration docs | **PASS** with explicit evidence levels                              |
| A05 deterministic tests and CI quality gate                 | **PASS locally; CI configured, not verified remotely**              |
| A06 secrets excluded, no unrelated changes/commits/pushes   | **PASS**                                                            |

## Prompt 02 may safely assume

The workspace/scripts, shared ESM Zod contract package, fictional fixtures, app factory/health boundary, loopback dev proxy, four-route shell and guarded migration machinery exist and pass local checks. It may extend these without inventing a new architecture. It must inspect current state first and preserve this work.

It **must not assume** PostgreSQL is available/migrated, AirNow credentials work, external response contracts match internal schemas, official historical snapshots exist, SDK integration has been rendered, or remote CI has passed. Verify the current official per-service contracts before any BFF/adapter work, keep the six retired legacy APIs forbidden, and recheck ArcGIS support before a later map milestone. No provider BFF, cache, station map/chart, wildfire analysis, AI or cloud deployment is included here.

## Changed-file inventory

| Area                 | Files added/changed                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root                 | `.gitignore`, `README.md`, `AGENTS.md`, `.env.example`, `.npmrc`, `.nvmrc`, `.prettierignore`, `.prettierrc.json`, `package.json`, `package-lock.json`, `eslint.config.js`, `tsconfig.base.json`, `tsconfig.tools.json`, `vitest.config.ts`, `vitest.db.config.ts`, `playwright.config.ts` |
| `packages/contracts` | `package.json`, `tsconfig.json`, `src/index.ts`                                                                                                                                                                                                                                            |
| `apps/api`           | `package.json`, `tsconfig.json`, `src/app.ts`, `src/config.ts`, `src/database.ts`, `src/environment.ts`, `src/server.ts`                                                                                                                                                                   |
| `apps/web`           | `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/App.tsx`, `src/main.tsx`, `src/style.css`, `src/App.test.tsx`, `src/test-setup.ts`                                                                                                                                   |
| Database/scripts     | `db/migrations/001_foundation.sql`, `scripts/migrations.ts`, `scripts/db-status.ts`, `scripts/db-migrate.ts`                                                                                                                                                                               |
| Fixtures             | `fixtures/README.md`, `fixtures/synthetic/site-observations.json`, `fixtures/historical/.gitkeep`                                                                                                                                                                                          |
| Tests/CI             | `tests/unit/contracts.test.ts`, `tests/unit/api.test.ts`, `tests/unit/migrations.test.ts`, `tests/integration/migrations.test.ts`, `tests/e2e/foundation.spec.ts`, `.github/workflows/ci.yml`                                                                                              |
| Docs                 | `docs/architecture/decisions.md`, `docs/architecture/database.md`, `docs/research/data-semantics.md`, `docs/data-sources/provider-capabilities.md`, this milestone report                                                                                                                  |
