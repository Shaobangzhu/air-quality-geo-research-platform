# Development rules

Product: Greater LA Air Quality Geo Research Platform. This is a local-first interview research PoC. Read README.md and the current milestone before changing behavior. Existing numbered prompt documents are reference material, not authorization to implement all milestones.

- Use Node 24 LTS, npm workspaces, strict TypeScript, React/Vite and Express. `packages/contracts` has shared Zod schemas with built ESM/type exports; build it before consumers. Keep the app factory separate from startup.
- Keep the four-page IA: `/map`, `/analysis`, `/wildfire`, `/data`. `/` shows the Map Explorer shell. No dashboard, AI, research-notes or settings routes in Core V1.
- Inspect git status first; preserve user changes and existing data. Do not commit/push unless instructed. Do not create/replace Docker stacks, delete containers/volumes, or query unrelated databases.
- Local PostgreSQL is user-managed. Only connect to an explicitly confirmed project database (`air_quality_geo_research` or `air_quality_geo_research_test`) on loopback. Use the dedicated `aq_workbench` schema. Never guess credentials. Missing PostgreSQL is a documented blocker.
- Migrations are append-only SQL with checksums, a transaction and an advisory lock. Refuse adoption of an unmarked schema. Do not modify applied migrations, reset/drop data, or add privileged role/database creation to the app. Parameterize runtime values.
- AQI and concentration are distinct. Keep raw values (including small negative measurements), nullable missing values, units, period meaning, source identity and UTC timestamps. Monitoring sites and reporting areas differ; forecasts and contours need separate contracts. Old AirNow records are not automatically validated AQS data.
- `sample` is explicitly synthetic, `historical` requires official snapshot provenance, `live` requires a real provider. `unavailable` is a state. No fake live values or implicit fallbacks. Synthetic fixture IDs start with `SAMPLE-`.
- Keep credentials server-only, except a deliberately public, browser-restricted ArcGIS credential. Never log connection strings, raw configuration errors, signed URLs or provider keys. Ignore real env files, dumps and build/test outputs.
- Provider live tests require `ALLOW_LIVE_API_TESTS=true`; none exist yet. Default tests, builds and UI work without keys. DB integration additionally requires `ALLOW_DB_TESTS=true` and the separate test DB.
- Verify official provider contracts before implementing adapters. The six legacy AirNow routes listed in the capability document are forbidden. Use current ArcGIS components when mapping is introduced; recheck version support then.
- Run lint, typecheck, unit tests, build and browser smoke. Run DB integration only against a confirmed test database. Report unrun checks honestly; configured CI is not remotely verified CI.

See `docs/architecture/decisions.md`, `docs/architecture/database.md`, `docs/data-sources/provider-capabilities.md` and `docs/research/data-semantics.md`.
