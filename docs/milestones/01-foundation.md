# Prompt 01 — implementation and verification

Date: **2026-10-25**. Scope: foundation only. No commits or pushes were made. Original numbered prompt documents are unchanged. The four supplied Downloads PNG paths did not exist; this milestone does not depend on them or claim visual fidelity to unseen designs.

## Delivered and verified decisions

- Node 24 LTS (local v24.19.0), npm 11.17.0, workspaces and lockfile. Installed React 19.3.1, Vite 8.3.5, Vitest 5.0.5, TypeScript 5.9.3, Express 5.3.0, Zod 4.6.7, pg 8.23.1 and supported ESLint 10.13.0. Clean install reported zero known dependency vulnerabilities at execution time.
- Built shared ESM/declaration exports resolve in browser, tests and Node. Strict type checking covers apps, tests and scripts. No provider credentials are needed for local verification.
- Express app factory is separate from startup. Startup makes no provider or DB query. Health reports API liveness, configured mode, explicitly unavailable air-quality data, and redacted DB status.
- Four responsive route shells, product identity, disclaimer and source/mode limitations. No fabricated AQI values, map or charts. Desktop (1440px) and mobile (390px) screenshots were visually reviewed; mobile smoke also checks no horizontal overflow.
- WGS84/ordered extent validation, string IDs, AQI/concentration discrimination and units, raw negatives, missing/zero distinction, UTC, period meaning, separate site/area observations, forecasts and contour metadata. Synthetic fixture labeling/provenance is enforced. No official historical sample has been acquired.
- Guarded local PostgreSQL targets, ownership confirmation, dedicated schema, transactional/advisory-locked checksummed migration runner. Unmarked schema adoption rolls back in the unit test. SQL execution is now verified in the new, explicitly authorized isolated PostgreSQL 18 target, including repeat migrations under non-admin roles.

## Command results

| Command / check                               | Result               | Evidence / limit                                                                                |
| --------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `npm ci`                                      | **PASS**             | Clean reinstall from lockfile; no provider keys                                                 |
| `npm run lint`                                | **PASS**             | ESLint + Prettier                                                                               |
| `npm run typecheck`                           | **PASS**             | Contracts, both apps, scripts and tests                                                         |
| `npm test`                                    | **PASS**             | 36 tests in 4 files; Supertest required local socket permission                                 |
| `npm run build`                               | **PASS**             | Shared declarations/ESM, compiled API, Vite production web                                      |
| `npm run test:e2e`                            | **PASS**             | 2 Chromium tests: local services/navigation/no provider requests; mobile layout                 |
| `npm run dev`                                 | **PASS**             | All three processes started; API/Vite reachable; contracts watch clean                          |
| Compiled API startup                          | **PASS**             | Built Node service probed on an alternate loopback port without provider/DB configuration       |
| `docker ps` / `docker inspect`                | **PASS**             | New target healthy; metadata for all eight pre-existing containers unchanged                    |
| `npm run db:setup`                            | **PASS**             | Created only the authorized project container, volume and network; refuses adoption/replacement |
| `npm run db:status`                           | **PASS**             | `Database: connected` with the restricted development role                                      |
| `npm run db:migrate`                          | **PASS**             | Applied `001_foundation.sql`; second run already current                                        |
| `npm run test:db` via `npm run test:db:local` | **PASS**             | 1 real integration test in the separate project test DB                                         |
| Actual repeatable PostgreSQL migration        | **PASS**             | Development/test schema and migration history verified without elevated app privileges          |
| Provider live tests                           | **NOT RUN**          | No adapters/live tests; opt-in policy only                                                      |
| GitHub Actions                                | **NOT RUN remotely** | Workflow configured with ephemeral PostgreSQL and all quality gates                             |
| `git diff --check` / artifact review          | **PASS**             | Existing prompt docs unchanged; generated output, env files and dumps excluded                  |

Early verification failures were corrected before final checks: a frontend selector matched both the brand and navigation; Supertest needed sandbox loopback permission. One command overlapped the clean reinstall and was discarded/rerun after install. The DB tool launcher was changed to `node --import tsx` to avoid unnecessary CLI IPC restrictions. These do not change the final results above.

## Database status and resolved blocker

**Local Docker PostgreSQL connectivity and repeatable migrations are now verified.** The user confirmed that `cpi-postgres` belongs to another project and explicitly authorized a new target named `air-quality-geo-research-platform-postgresql`. That authorization supersedes the original restriction on creating new infrastructure only for this named isolated target.

The new PostgreSQL 18.6 container is healthy at `127.0.0.1:55436`. It uses dedicated volume `air-quality-geo-research-platform-postgresql-data` and bridge network `air-quality-geo-research-platform-postgresql-network`. The development database `air_quality_geo_research` is owned by restricted role `aq_workbench_app`; the integration database `air_quality_geo_research_test` is owned by separate restricted role `aq_workbench_test`. Neither role is a superuser or can create roles/databases, replicate, bypass row security or connect to the other database. Application migration code requires no bootstrap privileges.

Generated credentials are saved only in ignored mode-600 `.env`, `.env.database-test` and `.local/postgresql/` files. No password was printed. A safe before/after metadata comparison passed for all eight containers that existed before this operation. No existing container, volume or unrelated database was started, reconfigured or altered. In particular, `cpi-postgres` remains untouched. [Database setup](../architecture/database.md) now documents provisioning, restart/stop lifecycle and integration-test commands.

The remote GitHub Actions workflow remains configured, not verified remotely. Local PostgreSQL is version 18; the independent CI service remains version 17.

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

| Criterion                                                   | Status                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A01 reproducible install/build/dev and four routes          | **PASS**                                                                     |
| A02 isolated PostgreSQL or precise safe blocker             | **PASS** — dedicated local target connected, migrated and integration-tested |
| A03 scientific contracts and synthetic fixtures             | **PASS**                                                                     |
| A04 provider capability/uncertainty and 2026 migration docs | **PASS** with explicit evidence levels                                       |
| A05 deterministic tests and CI quality gate                 | **PASS locally; CI configured, not verified remotely**                       |
| A06 secrets excluded, no unrelated changes/commits/pushes   | **PASS**                                                                     |

## Prompt 02 may safely assume

The workspace/scripts, shared ESM contracts, fictional fixtures, app factory/health boundary, loopback dev proxy, four-route shell and guarded migrations exist and pass local checks. The named local PostgreSQL target is provisioned, connected and migrated; a separate test DB/role and ignored local test launcher exist. Use the generated project configuration and manage only this project target. Inspect current state first and preserve this work.

It **must not assume** AirNow credentials work, external response contracts match internal schemas, official historical snapshots exist, SDK integration has been rendered, or remote CI has passed. Verify the current official per-service contracts before any BFF/adapter work, keep the six retired legacy APIs forbidden, and recheck ArcGIS support before a later map milestone. No provider BFF, cache, station map/chart, wildfire analysis, AI or cloud deployment is included here.

## Changed-file inventory

| Area                 | Files added/changed                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root                 | `.gitignore`, `README.md`, `AGENTS.md`, `.env.example`, `.npmrc`, `.nvmrc`, `.prettierignore`, `.prettierrc.json`, `package.json`, `package-lock.json`, `eslint.config.js`, `tsconfig.base.json`, `tsconfig.tools.json`, `vitest.config.ts`, `vitest.db.config.ts`, `playwright.config.ts`, `compose.postgresql.yml` |
| `packages/contracts` | `package.json`, `tsconfig.json`, `src/index.ts`                                                                                                                                                                                                                                                                      |
| `apps/api`           | `package.json`, `tsconfig.json`, `src/app.ts`, `src/config.ts`, `src/database.ts`, `src/environment.ts`, `src/server.ts`                                                                                                                                                                                             |
| `apps/web`           | `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/App.tsx`, `src/main.tsx`, `src/style.css`, `src/App.test.tsx`, `src/test-setup.ts`                                                                                                                                                             |
| Database/scripts     | `db/migrations/001_foundation.sql`, `scripts/migrations.ts`, `scripts/db-status.ts`, `scripts/db-migrate.ts`                                                                                                                                                                                                         |
| Fixtures             | `fixtures/README.md`, `fixtures/synthetic/site-observations.json`, `fixtures/historical/.gitkeep`                                                                                                                                                                                                                    |
| Tests/CI             | `tests/unit/contracts.test.ts`, `tests/unit/api.test.ts`, `tests/unit/migrations.test.ts`, `tests/integration/migrations.test.ts`, `tests/e2e/foundation.spec.ts`, `.github/workflows/ci.yml`                                                                                                                        |
| Docs                 | `docs/architecture/decisions.md`, `docs/architecture/database.md`, `docs/research/data-semantics.md`, `docs/data-sources/provider-capabilities.md`, this milestone report                                                                                                                                            |

### Authorized database follow-up files

- `compose.postgresql.yml`: one dedicated local service with exact container/network/volume names and an administrative secret file.
- `db/bootstrap/project_databases.sql`: new-target role/database provisioning, separate from app migrations.
- `scripts/setup-local-postgresql.mjs`: guarded one-time setup, random local credentials and a safe before-state snapshot.
- `scripts/test-local-database.mjs`: explicit test-only environment launcher.
- Updated `.gitignore`, `.env.example`, `package.json`, `AGENTS.md`, README and architecture/milestone docs. Generated credentials and local state remain ignored.
