# Prompt 07 — separate reporting-area AQI and forecast products

Implemented on 2026-10-26 against completed Prompts 01–06. Git was clean at the start. No staging, commit or push was performed.

## Functional products and blocked official capabilities

| Product / mode                    | Actual delivered behavior                                                                                     | Evidence                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Monitoring Stations               | Existing sample readings, selection, map layer and Analysis handoff retained                                  | Full regression suite; real browser restores the same station layer/view |
| Reporting Area AQI / Sample       | Functional independent aggregate-AQI BFF, product legend, identity list and source/detail drawer              | Actual local synthetic fixtures/API/UI, never an official response       |
| Forecast / Sample                 | Functional independent prediction BFF/UI; category-only AQI, date-only validity and unknown issuance retained | Actual local synthetic fixtures/API/UI                                   |
| Reporting Area AQI / Live         | **Unavailable**; production codec not registered                                                              | Guard tested, no provider traffic                                        |
| Forecast / Live                   | **Unavailable**; production codec not registered                                                              | Guard tested, no provider traffic                                        |
| Reporting-area historical archive | **Unavailable**; no reviewed ingestion or archive configured                                                  | Typed error, no station snapshot reuse                                   |
| Official area geography           | **Unverified / not plotted**                                                                                  | No polygon, centroid or representative-location contract inspected       |

Official-product acceptance is not complete: the unauthenticated official catalog exposes capabilities but not the full new request/auth/response/time contracts. The available AirNow key was checked only as present; the live-test opt-in remains false. A key is not a docs-site login, and no auth/query field was guessed. The required fallback boundary is implemented and tested, but a functioning synthetic sample is not proof of an official product.

## Source audit and paths

Inspected the [June 2026 notice](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf), [service catalog](https://docs.airnowapi.org/webservices), [FAQ](https://docs.airnowapi.org/faq) and public login page. The public catalog returned HTTP 200 with descriptions and Login, but no detailed service-specific specification/query tool. The notice documents the replacement path families and migration dates; it does not define the changed fields. Detailed evidence is in [the capability decision table](../data-sources/airnow-area-products-verification.md).

| Path                                  | Status / use                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/aq/observation/current/racode/`     | Officially named candidate; exact contract unverified; only an adapter destination allowlist, never called live |
| `/aq/observation/current/ziplatlong/` | Officially named candidate; not implemented, no ZIP/location sweep                                              |
| `/aq/forecast/current/`               | Officially named candidate; exact contract unverified; only an adapter destination allowlist, never called live |
| `/aq/observation/historical/state/`   | Officially named candidate; no ingestion/backfill implemented                                                   |
| `/aq/forecast/historical/`            | Officially named candidate; no ingestion/backfill implemented                                                   |

No production AirNow request parameters, external response names, numeric rate quota or retention guarantees were invented. Mock-only `mockAreaFixture` / `mock_test_key` are deliberately synthetic and not registered in runtime code. The six retired ZIP/location paths are all rejected before transport. Official full URL/auth execution remains unverified; destination restrictions are not a successful smoke test.

## Domain, UX and cache decisions

Aggregate AQI and predictions have strict separate discriminators/fields. Neither has station ID, concentration, monitoring instrument or station averaging semantics. Identity hashes `(provider, area code)` and preserves leading zeroes/letters. Supplied canonical AQI/category mismatches are rejected. Category-only forecasts retain a null AQI; unknown issuance/observation instants remain null. Date-only validity stays a calendar date and nullable source timezone, without a made-up hourly or 24-hour UTC interval. Fetch, observed, issued and valid times are distinct.

Sample fixtures explicitly use fictional area names/codes/agency and fixed January 2026 dates. The PM2.5 aggregate response contains two identities, including a missing AQI/category example. Its forecast response contains two date-valid predictions for one identity, including category-only/unknown-issuance data. O3 has separate supplied examples; PM10 is absent rather than fabricated. Scope is a synthetic Greater LA declaration; smaller engineering presets return empty without claiming actual absence. Geometry is null in every record.

Map Explorer reuses the same component-owned ArcGIS map/view and existing extent. The station layer is empty/invisible for area products; no guessed area symbols or polygons replace it. Product legends distinguish area aggregates from predictions, and the drawer shows source/agency/category/time precision. The only Data Product choices are Monitoring Stations and the two clearly labeled Sample alternatives; official Live/Historical alternatives are disabled with explicit unavailable states on direct links. There is no new page/dashboard, forecast chart or Analyze action for area records. Methodology links preserve the area product/id; Analysis navigation explicitly restores monitoring-station context without converting area IDs to station IDs.

Read-only `/api/reporting-area-aqi` and `/api/forecasts` enforce strict region/pollutant/mode/area-code/pagination queries. Batches cap 10 identities/40 records/125 kB; the independent cache caps 16 entries/four in-flight loads, coalesces equivalent reads, returns clones and does not serve expired data after failure. Engineering TTL is five minutes for aggregates and thirty minutes for forecasts; these are not verified quotas/SLA. Existing bounded HTTP timeout/retry/429 controls and API usage metrics are shared. No DB migration, archive write, broad historical backfill, ZIP mirror or provider-startup request was added.

## Changed files

| Files                                                                                                                                                    | Purpose                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/area-products.ts`, `bff.ts`, `index.ts`                                                                                          | Independent product/identity/source/time schemas and catalog capabilities; strict semantics                                           |
| `fixtures/synthetic/area-products.json`                                                                                                                  | Explicit application-only synthetic examples; no station fixture changed                                                              |
| `apps/api/src/bff/{area-cache,area-providers,area-service}.ts`                                                                                           | Bounded independent service/cache, validated fixture provider and unregistered guarded live adapter seam                              |
| `apps/api/src/{app,server}.ts`, `bff/{runtime,service,errors}.ts`                                                                                        | Read-only endpoints, shared runtime usage/HTTP, product catalog and safe unavailable errors                                           |
| `apps/web/src/use-area-products.ts`, `areas/AreaProducts.tsx`                                                                                            | Typed canceled product reads, separate legends/list/drawer and source/time/keyboard behavior                                          |
| `apps/web/src/{App,route-state}.tsx` / `.ts`, `map/MapExplorer.tsx`, `style.css`                                                                         | Separate product/area URL state, active-source status, hidden station graphics on the same view, disabled modes and responsive layout |
| `tests/helpers/areas.ts`, `tests/unit/area-products.test.ts`, `apps/web/src/areas/AreaProducts.test.tsx`, `App.test.tsx`, `tests/e2e/foundation.spec.ts` | Mock-only boundary, query/cache/errors/identity/secrets, UI separation/deep links/cancellation and browser regressions                |
| README / AGENTS / provider evidence / frontend / BFF / scientific docs, this report                                                                      | Exact functional-vs-blocked state, application contract, cache policy, source evidence and acceptance                                 |

Station provider codec, SQL repository, applied migrations, Docker configuration and Analysis/wildfire implementation files were preserved. No dependency or real environment setting changed. Built JS/CSS/HTML was scanned across 1,412 text assets: no configured server API keys, AQS email or database connection string were found; the deliberately public ArcGIS browser token is excluded from this server-secret check. Station historical snapshot IDs are stripped from area-product links; no station archive is presented as an area archive. The existing public ArcGIS credential remained browser-only; actual AirNow/AQS/OpenAI keys remained server-only.

## Verification actually executed

The final standard local gates passed. During development the selected disabled native option required a `disabled` attribute assertion because Chromium/Playwright's option-state matcher reported it enabled despite the attribute; the native UI itself was disabled. No fake live result or fallback was introduced to pass tests.

| Check                                       | Final result                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run lint`                              | **Passed**                                                                                               |
| `npm run typecheck`                         | **Passed**                                                                                               |
| `npm test`                                  | **170 passed / 18 files**                                                                                |
| `npm run build`                             | **Passed**, 6,297 modules; entry 395.56 kB / 119.14 kB gzip; existing large ArcGIS chunk warning applies |
| `npm run test:e2e`                          | **10 Chromium tests passed**; isolated ports 5174/3103, no provider/browser key needed                   |
| `git diff --check`                          | **Passed**                                                                                               |
| DB integration                              | Not rerun: no schema/repository/DB path changed; new area archive is intentionally unavailable           |
| Authenticated AirNow / AQS / OpenAI request | **Not run**                                                                                              |
| Remote CI / Firefox / WebKit                | Not executed                                                                                             |

Coverage includes current/forecast field separation, category mismatch, missing/empty data, date/issuance bounds, identity leading zeroes/provider separation, geometry refusal, region/query caps, unverified/live/archive guards, all six retired paths, 429/deadline failures, empty mocked product, cache TTL/dedup/cloning/expiry, reflected-secret rejection, canceled/wrong-product responses, routing/deep links, keyboard focus, responsive details and unchanged Analysis. Mock transport payloads are labeled application test doubles, not official wire examples.

Actual dev-browser ArcGIS evidence from `.local/milestone07/browser-verification.json`:

| Measurement                                                     | Result                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Aggregate response                                              | **Sample**, two PM2.5 records, every geometry null                                  |
| Current/Forecast map element, view and station-layer identities | **Unchanged**                                                                       |
| Station visibility/graphics in each area mode                   | **False / 0**                                                                       |
| Map layer count in Forecast                                     | **2**, existing engineering extent and hidden station layer; no invented area layer |
| Monitoring Stations restored on same view                       | **Yes**, three graphics                                                             |
| Category-only, date-only and unknown-issuance forecast details  | **Verified**                                                                        |
| Product reads during details/legend/keyboard actions            | **0**                                                                               |
| Live contract-unavailable local guard                           | **Verified**, no external data request                                              |
| Browser AirNow/AQS/OpenAI calls / BFF outbound delta            | **0 / 0**                                                                           |
| Unhandled browser errors                                        | **0**                                                                               |
| Horizontal overflow at 1440/1280/390px                          | **None**                                                                            |

Screenshots in the ignored `.local/milestone07/` directory include `area-current-1440.png` and `area-forecast-{1440,1280,390}.png`; Forecast 1440px and 390px were visually inspected. Real basemap tile success does not validate any air-quality service, official geometry, API key permissions or production deployment. Offline E2E uses no ArcGIS credential; remote CI has not been executed.

## Acceptance and Prompt 08 handoff

| Criterion                                               | Status                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01: Separate fully tested application records          | **Met for application contracts**; strict aggregate/prediction identity/unit/time contracts                                                                        |
| A02: At least one verifiable new product functional     | **Blocked for official products**: detailed contracts unavailable and no live-test opt-in. Both synthetic alternatives are functional, with no official/live claim |
| A03: Current verified paths, no retired calls           | Path families documented; allowlist and retired-route rejection tested. Full auth/request/response verification remains **blocked**                                |
| A04: Uncluttered product-specific Map UI                | **Met for labeled samples**; shared map, separate legends/details, no station overlay or invented geography                                                        |
| A05: Deterministic gates and honest verification status | **Met locally**; all standard local gates passed; no live or remote-CI result fabricated                                                                           |

Prompt 08 can reuse product-specific routing, provenance/time precision, bounded request/cache boundaries and station-view lifecycle. It must independently verify official KML/layer/geometry contracts and attribution before drawing them. To unblock official area products, obtain current authorized per-service specs, implement a reviewed codec with a sanitized real example, establish bounded area membership and perform one explicitly opted-in smoke request. No forecast may enter station Analysis, and no ZIP centroid may silently become an official area polygon/centroid.
