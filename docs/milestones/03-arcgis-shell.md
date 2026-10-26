# Prompt 03 — shared UI and persistent ArcGIS map

Implemented on **2026-10-25**. The repository was clean at the start. No commit or push was made.

## Delivered behavior

The workbench now follows the supplied light blue/white concept direction with a mountain brand, exact product/subtitle text, four horizontal navigation links, visible active route, native accessible controls and truthful text status. Map Explorer owns the region/pollutant/data-product toolbar and data-mode selection. The map dominates the workspace, with a collapsible Layers & Legend overlay and station details only after selecting an identity.

A fixed neutral ArcGIS basemap and dashed WGS84 engineering study extent are implemented. There are no station map symbols, data-driven measurement colors or map-page charts in this milestone. An accessible BFF-backed identity list demonstrates selection/drawer behavior even when tiles are unavailable. Sample returns three explicitly fictional monitor identities per pollutant. Co-located monitors remain distinct; no real station names, values or photos were copied from the mockup.

The other three routes are planned-module placeholders with working navigation and no dead feature controls. Region/product and the future station-symbol control are disabled with explanations because only one region/product and the geographic extent layer are currently supported. Pollutant, mode, legend, supported extent visibility, identity selection, close/Escape and Back/Forward work.

The UI explicitly defaults to Sample. Live remains unavailable through the unchanged AirNow contract guard; historical requires an identified official curated snapshot. Failed requests never switch to sample automatically. Header mode reflects verified station-context metadata; basemap availability is independent. Invalid/duplicate deep-link values have safe defaults, allowed selections survive navigation, and station records/datasets are not serialized into URLs.

## Files changed

| Files                                                                               | Purpose                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/App.tsx`                                                              | Shared shell, navigation, focus/title handling and truthful future-page placeholders                           |
| `apps/web/src/route-state.ts`                                                       | Four-page definitions, shared labels and validated compact URL state                                           |
| `apps/web/src/use-stations.ts`                                                      | Typed BFF station reads, cancellation/deadline and context isolation                                           |
| `apps/web/src/components/{Icon,ModeBadge,StationDrawer}.tsx`                        | Small reusable icon/status/detail components                                                                   |
| `apps/web/src/map/MapExplorer.tsx`                                                  | Toolbar, legend, map/identity-list/drawer composition                                                          |
| `apps/web/src/map/MapCanvas.tsx`                                                    | Lazy SDK lifecycle boundary, loading/unavailable states, bounded initialization                                |
| `apps/web/src/map/arcgis-runtime.ts`                                                | Actual component-owned map, reactive extent/visibility and explicit cleanup                                    |
| `apps/web/src/style.css`                                                            | Design tokens, interaction states and responsive desktop/mobile layouts                                        |
| `apps/web/{package.json,vite.config.ts}`, `package-lock.json`, `.env.example`       | Pinned SDK dependencies, deliberate public-token environment discovery and documented configuration            |
| `apps/web/src/App.test.tsx`, `apps/web/src/map/{MapCanvas,arcgis-runtime}.test.tsx` | React/navigation/mode/error/selection and stubbed SDK lifecycle coverage                                       |
| `playwright.config.ts`, `tests/e2e/foundation.spec.ts`                              | Dedicated test ports, zero-key deterministic browser smoke, keyboard/deep-link/viewport checks and screenshots |
| `docs/frontend/{design-system,arcgis-map}.md`                                       | Tokens, routes, URL semantics, SDK/auth/lifecycle and viewport constraints                                     |
| `README.md`, `AGENTS.md`, `docs/architecture/decisions.md`, this report             | Current milestone behavior and maintenance/handoff guidance                                                    |

No API implementation, shared scientific contract, migration, database, Compose definition or Docker resource was changed. Existing development servers were left running; browser tests used separate ports 5174/3103.

## SDK, authentication and lifecycle

The [official current SDK guide](https://developers.arcgis.com/javascript/latest/) identifies 5.1. npm version checks resolved **`@arcgis/core@5.1.27` and `@arcgis/map-components@5.1.27`**. Both are pinned, with compatible Calcite **5.1.1**. The [official React integration](https://developers.arcgis.com/javascript/latest/react/) and [map component API](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-map/) support the component-owned view approach. No direct `MapView` or legacy widget is created. Existing package versions were not upgraded by dependency installation.

Each Map Explorer mount owns one `Map`/`arcgis-map`/extent layer. Updates reuse it; readiness/error event listeners and the fatal watcher are installed once and removed. Explicit idempotent component destruction releases view/map/layers on unmount. Async loading is canceled before late mount; a stalled initialization degrades after 15 seconds. Missing credentials skip SDK initialization. Basemap loading failures and fatal view errors produce a safe unavailable state and release resources. No observation fetch occurs on pan/zoom or layer/drawer changes.

Root `.env` now supplies the deliberately public `VITE_ARCGIS_API_KEY`. It is intentionally eligible for browser assets/ArcGIS requests. Use basemap-only privileges and intended HTTP referrers as explained in [authentication setup](../frontend/arcgis-map.md). The actual local token worked; its account-side privileges/referrer settings were **not independently audited**. No extra confirmation flag was introduced, and the real env file was not edited. AirNow/AQS/OpenAI/DB credentials remain server-only. `ALLOW_LIVE_API_TESTS=false` was preserved. Actual ArcGIS basemap requests are separate from live air-quality provider verification.

## Commands and evidence

| Check                                                                    | Result                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm view` SDK package versions; `npm install -w @aq/web --save-exact …` | Pinned compatible packages installed; npm install audit reported zero vulnerabilities. Registry access required sandbox elevation; an incompatible initial Calcite choice was corrected to the declared peer version without force/legacy-peer-deps.                            |
| `npm run lint`                                                           | PASS — ESLint and Prettier                                                                                                                                                                                                                                                      |
| `npm run typecheck`                                                      | PASS — shared contracts, API, web and tools                                                                                                                                                                                                                                     |
| `npm test`                                                               | PASS — **108 tests / 11 files**, including 16 React/SDK tests; SDK mocked with no external tiles. Local socket permission was required for existing Supertest tests.                                                                                                            |
| `npm run build`                                                          | PASS — API/contracts/web; 5,846 web modules transformed. Entry JS about **348.29 kB / 108.29 kB gzip**; lazy ArcGIS runtime chunk about **1,139.96 kB / 271.99 kB gzip**. Vite retains its >500 kB chunk warning; SDK loading is lazy, not an offline or bundle-size guarantee. |
| `npm run test:e2e`                                                       | PASS — **5 Chromium tests**; actual local BFF in sample mode, browser keys cleared, no external network requests in the navigation flow and zero outbound AirNow/AQS attempts                                                                                                   |
| Actual configured-browser verification                                   | PASS — real ArcGIS basemap visible at 1440×900, 0 unhandled browser errors, 0 browser AirNow/AQS/OpenAI requests                                                                                                                                                                |
| Actual lifecycle/interaction check                                       | PASS — identical component and view across pollutant change, drawer opening and extent toggle; exactly 1 component while mounted; view destroyed and 0 components after navigating to Analysis                                                                                  |
| Viewport screenshots / visual review                                     | 1440×900 and 1280×900 reviewed; 390×900 responsive fallback also captured. No horizontal document/workspace overflow with or without the drawer.                                                                                                                                |
| Built asset credential scan                                              | **1,116 JS/CSS assets checked**, none contained configured AirNow key, AQS key/email, OpenAI key or database URL. Public ArcGIS token is the intentional exception.                                                                                                             |
| `git diff --check` and unchanged backend/schema/Compose comparison       | PASS                                                                                                                                                                                                                                                                            |
| DB integration / remote CI / other browser engines                       | Not run for this frontend-only milestone; GitHub Actions remains configured, not remotely verified                                                                                                                                                                              |

The browser check used the existing development server and public ArcGIS token; its visible tiles are real geographic context. The UI data stayed **Sample · Synthetic** throughout. No real air-quality measurement or official historical dataset was acquired. Browser smoke did not require AirNow. Unit tests inject an SDK loader and separately stub core/component modules, exercising mount/update/timeout/load-error/fatal-error/dispose behavior without WebGL/network.

## Screenshots

Generated screenshots are retained as ignored local artifacts in `.local/milestone03/`, not committed data:

- [Actual ArcGIS basemap, 1440px](../../.local/milestone03/map-real-1440.png)
- [Actual ArcGIS map, selected synthetic identity and extent toggle off, 1280px](../../.local/milestone03/map-real-drawer-1280.png)
- [Missing-key fallback, 1440px](../../.local/milestone03/map-no-key-1440.png)
- [Missing-key fallback and selected drawer, 1280px](../../.local/milestone03/map-no-key-drawer-1280.png)
- [Responsive fallback and selected drawer, 390px](../../.local/milestone03/map-no-key-drawer-390.png)

Esri attribution is preserved. Actual tiles are network-dependent; no offline basemap is promised. Isolated future tile failures can be handled internally by the SDK, even when its view and base-layer views remain ready. Other browser engines, production-host token restrictions, and a production-served interactive map were not separately exercised.

## Acceptance and Prompt 04 handoff

| Criterion                                                                             | Status                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A01 — recognizable four-page shared UI; no fifth page                                 | PASS                                                                                  |
| A02 — persistent 2D map and graceful unavailability                                   | PASS — actual configured browser plus deterministic missing-key/error lifecycle tests |
| A03 — compact three-filter layout, map, collapsible legend, conditional drawer        | PASS — geographic shell/metadata only, explicitly labeled; no full charts             |
| A04 — navigation and validated deep links                                             | PASS — unit, keyboard, Back/Forward and browser checks                                |
| A05 — deterministic tests/build, truthful sample labeling and server-secret isolation | PASS                                                                                  |

Prompt 04 can build the actual monitoring-station layer and measurement-aware symbols using the existing BFF contracts and this stable map adapter. Live AirNow still needs an exact officially verified wire codec before requests can be enabled; a prepared key alone does not remove that dependency. Historical workflows require curated official snapshots. Preserve native string identities, co-located monitors, units, period meaning, missing/negative raw values and independent data status/mode. Add station hit testing and keyboard-equivalent selection without duplicating maps/listeners or introducing observation fetches on each pan. Analysis linking, real charts, wildfire, export, 3D, AI and cloud deployment remain later work.
