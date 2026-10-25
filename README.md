# Greater LA Air Quality Geo Research Platform

**Interdisciplinary Research & Software Engineering Workbench — v1**

A local-first TypeScript research/interview PoC. Milestone 01 provides contracts, synthetic test fixtures, an Express health service, a React shell and guarded PostgreSQL migrations. No provider adapter, station map, chart or real air-quality result is implemented. This is not a regulatory or emergency-response tool.

## Run locally

Use **Node 24 LTS** and npm 11+. No provider key or database is required for the shell or default tests.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open [Map Explorer](http://127.0.0.1:5173/map). API health: [localhost:3001/api/health](http://127.0.0.1:3001/api/health). Vite proxies `/api` to the API. Startup makes no provider or DB query. Stop with Ctrl-C. Changing API port 3001 also requires changing Vite's proxy target.

| Route       | Milestone 01 behavior     |
| ----------- | ------------------------- |
| `/map`      | Map Explorer shell        |
| `/analysis` | Analysis shell            |
| `/wildfire` | Wildfire Case Study shell |
| `/data`     | Data & Methodology shell  |

`/` shows Map Explorer; no separate home dashboard. Links work but modules are visibly planned. `DATA_MODE=sample` means synthetic mode, not live with fallback. Health reports data **unavailable** in every mode until a later milestone loads data. If the API fails, the UI reports unknown mode. DB connectivity is separate from air-quality availability.

## Commands

| Command              | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Build/watch contracts, run API and Vite                 |
| `npm run typecheck`  | Strict types for contracts, apps, scripts and tests     |
| `npm run lint`       | ESLint + Prettier check                                 |
| `npm test`           | Offline contract, API, migration-safety and React tests |
| `npm run build`      | Build shared ESM/types, API and web                     |
| `npm run start:api`  | Start built API after build                             |
| `npm run test:e2e`   | Start local app processes; Chromium smoke               |
| `npm run db:status`  | Redacted connectivity status; exit 1 if not connected   |
| `npm run db:migrate` | Apply pending checksummed migrations; no drops          |
| `npm run test:db`    | Opt-in PostgreSQL repeatability test                    |
| `npm run format`     | Format code and newly authored docs                     |

For browser tests install Chromium once: `npx playwright install chromium` (Linux CI also uses `--with-deps`). A busy port fails explicitly; tests do not attach to existing servers. Browser tests override DB and mode configuration. Unit tests make no external provider calls; Supertest uses local sockets.

## Database and credentials

Docker inspection on **2026-10-25** succeeded and found only a MongoDB container; no PostgreSQL container or project DB configuration was identified. **Local PostgreSQL connection and migrations are unverified.** No existing database was queried or modified. Follow [database setup](docs/architecture/database.md) once you supply a dedicated PostgreSQL database in your existing infrastructure. No local Compose stack is provided.

Real `.env` files and DB exports are ignored. Keep `AIRNOW_API_KEY`, `AQS_EMAIL`, `AQS_API_KEY` and future `OPENAI_API_KEY` on the server. Only a deliberately public, least-privilege, referrer-restricted ArcGIS credential may use `VITE_ARCGIS_API_KEY`; it is not consumed yet. Future provider live tests require `ALLOW_LIVE_API_TESTS=true`.

## Structure and next steps

`apps/web` → React shell; `apps/api` → Express/config/DB status; `packages/contracts` → browser/Node schemas; `fixtures/synthetic` → fictional examples; `fixtures/historical` → empty official-snapshot reservation; `db/migrations` → SQL; `scripts` → DB tools; `tests` → unit/integration/e2e; `.github/workflows/ci.yml` → quality gate with an isolated ephemeral PostgreSQL service.

Read [architecture](docs/architecture/decisions.md), [provider verification matrix](docs/data-sources/provider-capabilities.md), [scientific semantics](docs/research/data-semantics.md) and [milestone verification](docs/milestones/01-foundation.md). The numbered prompt library is preserved. Only Prompt 01 is implemented; later milestones cover provider BFF contracts, ArcGIS shell, stations, pollutant interaction, time series, reporting areas, wildfire context and provenance/export. AI/RAG and cloud hosting are outside Core V1. **GitHub Actions is configured, not verified remotely.**

## Troubleshooting

- Invalid configuration: check named fields against `.env.example`; do not paste secrets into logs/issues. Blank `DATABASE_URL` is valid. A URL also needs explicit ownership confirmation and an allowed loopback/database target.
- API unavailable: run both processes with `npm run dev`; check ports 3001 and 5173.
- Missing contracts output: root scripts build contracts first; for direct workspace commands run `npm run build -w @aq/contracts` once.
- DB/migration rejection: verify the user-managed service, isolated DB, role privileges and schema marker. Driver errors are redacted. Restore original applied migrations for checksum failures and add a new migration; do not reset data.
- Missing screenshots: the four supplied Downloads PNG paths did not exist. This foundation does not depend on them; later UI work needs available references.
