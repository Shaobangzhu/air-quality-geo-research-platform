# Greater LA Air Quality Geo Research Platform

**Interdisciplinary Research & Software Engineering Workbench — v1**

A local-first TypeScript research/interview PoC. Milestone 06 added bounded 24/48/72-hour Analysis charts for up to three compatible monitoring identities, preserving sparse records, gaps, source status and UTC/DST semantics. Milestone 07 adds separate explicitly synthetic reporting-area AQI and Forecast alternatives in Map Explorer; official new-service contracts and area geometry remain unverified. Map Explorer retains engineering presets, station readings and its Analyze handoff. Sample sites and values are explicitly synthetic; live AirNow access remains contract-unverified. Prompt 08 adds a verified Eaton Fire historical case with bounded CAL FIRE/OSFM layers, EPA observations and a case-specific methodology view. This is not a regulatory or emergency-response tool.

## Run locally

Use **Node 24 LTS** and npm 11+. No provider key or database is required for the shell or default tests.

```sh
npm ci
npm run dev
```

Open [Map Explorer](http://127.0.0.1:5173/map). API health: [localhost:3001/api/health](http://127.0.0.1:3001/api/health). Vite proxies `/api` to the API. Server startup makes no provider or DB query; opening the map loads local sample metadata and, when configured, ArcGIS basemap tiles. Stop with Ctrl-C. For another API port, set the server-only `AQ_API_PROXY_TARGET` environment variable on the Vite process.

| Route       | Current behavior                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `/map`      | Station readings plus separate synthetic area/forecast alternatives, source-aware details and stable ArcGIS view |
| `/analysis` | Up to three compatible station series, gap-aware chart, source summary and Data handoff                          |
| `/wildfire` | Verified 2025 Eaton historical GIS case with local source snapshots                                              |
| `/data`     | Case provenance view; full export/metrics still planned                                                          |

`/` shows Map Explorer. URL state preserves validated region/pollutant/mode and optional station/snapshot context. The UI explicitly defaults to Sample and labels the fictional metadata. Select Live or Historical on the map page to see their actual availability; no sample fallback occurs. A missing or rejected ArcGIS token shows a map-unavailable state while station readings remain usable. Read [station observation semantics](docs/frontend/station-observations.md), the [frontend design system](docs/frontend/design-system.md) and [ArcGIS setup/lifecycle](docs/frontend/arcgis-map.md).

## Commands

| Command                                              | Purpose                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                                        | Build/watch contracts, run API and Vite                    |
| `npm run typecheck`                                  | Strict types for contracts, apps, scripts and tests        |
| `npm run lint`                                       | ESLint + Prettier check                                    |
| `npm test`                                           | Offline contract, API, migration-safety and React tests    |
| `npm run build`                                      | Build shared ESM/types, API and web                        |
| `npm run start:api`                                  | Start built API after build                                |
| `npm run test:e2e`                                   | Start local app processes; Chromium smoke                  |
| `npm run snapshots:import -- --file <manifest.json>` | Import a bounded, labeled local sample/official snapshot   |
| `npm run provider:airnow:smoke`                      | Explicit opt-in verification gate; currently no live codec |
| `npm run db:setup`                                   | Provision the authorized isolated PostgreSQL target once   |
| `npm run test:db:local`                              | Run integration against the separate generated test target |
| `npm run db:status`                                  | Redacted connectivity status; exit 1 if not connected      |
| `npm run db:migrate`                                 | Apply pending checksummed migrations; no drops             |
| `npm run test:db`                                    | Opt-in PostgreSQL repeatability test                       |
| `npm run format`                                     | Format code and newly authored docs                        |

For browser tests install Chromium once: `npx playwright install chromium` (Linux CI also uses `--with-deps`). Tests use dedicated ports 5174/3103; a busy test port fails explicitly, and tests do not attach to existing development servers. Browser tests override DB and mode configuration. Unit tests make no external provider calls; Supertest uses local sockets.

## Database and credentials

The dedicated Docker target **`air-quality-geo-research-platform-postgresql`** is provisioned and healthy at `127.0.0.1:55436`, with its own network/volume and separate development/test databases. Local connection, repeat migrations and PostgreSQL integration tests have passed. The user explicitly authorized creating this target; `cpi-postgres` belongs to another project and was not used. All eight pre-existing containers retained their state/configuration. For fresh provisioning and lifecycle commands see [database setup](docs/architecture/database.md). Setup writes ignored `.env` files with generated credentials; preserve them when restarting the target.

Real `.env` files and DB exports are ignored. Keep `AIRNOW_API_KEY`, `AQS_EMAIL`, `AQS_API_KEY` and future `OPENAI_API_KEY` on the server. Only a deliberately public, least-privilege, referrer-restricted ArcGIS credential may use `VITE_ARCGIS_API_KEY`; it is now consumed from the root `.env` by the map SDK. Basemap verification is separate from live air-quality provider verification. Provider smoke verification requires `ALLOW_LIVE_API_TESTS=true`; the current false flag was preserved. A flag/key cannot bypass the unverified wire-contract guard. No AirNow/AQS/OpenAI provider was called; the browser ArcGIS basemap was verified.

## Structure and next steps

`apps/web` → React shell; `apps/api` → Express/config/DB status; `packages/contracts` → browser/Node schemas; `fixtures/synthetic` → fictional examples; `fixtures/historical` → checksummed Eaton official snapshots; `db/migrations` → SQL; `scripts` → DB tools; `tests` → unit/integration/e2e; `.github/workflows/ci.yml` → quality gate with an isolated ephemeral PostgreSQL service.

Read [architecture](docs/architecture/decisions.md), [provider verification matrix](docs/data-sources/provider-capabilities.md), [scientific semantics](docs/research/data-semantics.md) and [milestone verification](docs/milestones/01-foundation.md). The numbered prompt library is preserved. Prompts 01–06 are implemented; Prompt 07 delivers the tested application boundary/sample UI with official-product acceptance blocked by the documented contract limit. Read [BFF endpoints/contracts](docs/architecture/provider-bff.md), [data modes/imports](docs/architecture/data-modes.md), [usage definitions](docs/architecture/api-usage.md), [AirNow evidence](docs/data-sources/airnow-live-verification.md) and the [Prompt 02 report](docs/milestones/02-provider-bff.md). Read the [Prompt 03 report](docs/milestones/03-arcgis-shell.md) for SDK/browser validation. Read the [Prompt 04 report](docs/milestones/04-station-observations.md) for station selection/provenance checks. Read the [Prompt 05 report](docs/milestones/05-linked-interaction.md) and [map interaction contract](docs/frontend/map-interactions.md) for region/filter/deep-link behavior. Read the [Prompt 06 report](docs/milestones/06-analysis-time-series.md) and [Analysis contract](docs/frontend/analysis-series.md). Read the [Prompt 07 report](docs/milestones/07-reporting-area-products.md) and [area-product evidence](docs/data-sources/airnow-area-products-verification.md). Later milestones cover verified geographic layers, wildfire context and export. AI/RAG and cloud hosting are outside Core V1. **GitHub Actions is configured, not verified remotely.**

## Troubleshooting

- Invalid configuration: check named fields against `.env.example`; do not paste secrets into logs/issues. Blank `DATABASE_URL` is valid. A URL also needs explicit ownership confirmation and an allowed loopback/database target.
- API unavailable: run both processes with `npm run dev`; check ports 3001 and 5173.
- Missing contracts output: root scripts build contracts first; for direct workspace commands run `npm run build -w @aq/contracts` once.
- DB/migration rejection: verify the user-managed service, isolated DB, role privileges and schema marker. Driver errors are redacted. Restore original applied migrations for checksum failures and add a new migration; do not reset data.
- UI reference images have since been supplied under `Downloads/air_quality_research_platform/`; they are design context for later page work. Their sample values and service-status labels are not evidence of live data or provider availability.
- Live 503 / `PROVIDER_CONTRACT_UNVERIFIED`: read the AirNow verification document. The public catalog verifies the retained route, but not its complete wire schema. No legacy SDK query was copied or enabled.
- Historical mode: supply an official curated `snapshotId`. An imported synthetic snapshot cannot be selected as historical.
- Snapshot capacity: the store stops new imports at 32 snapshots/512 identities; no data is automatically removed.

Prompt 08: see [wildfire case report](docs/milestones/08-wildfire-case-study.md), [source feasibility](docs/data-sources/eaton-case-feasibility.md) and [UI/contract behavior](docs/frontend/wildfire-case.md). Open `/wildfire` for the historical case. Seed its reviewed local artifacts with `npm run db:seed:historical-case -- --target air_quality_geo_research` after `npm run db:migrate`. No source is re-fetched on launch.
