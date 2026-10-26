# AirNow reporting-area products — evidence and decision, 2026-10-26

The official [June 2026 migration notice](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf), [current service catalog](https://docs.airnowapi.org/webservices), [FAQ](https://docs.airnowapi.org/faq) and public login page were inspected. The catalog was accessible with a normal unauthenticated HTTP 200 response; its HTML contained product descriptions and Login, without service-specific request/response specifications or a public query tool. This is an access limit of the session, not proof that the services are down. An API key is not a documentation-site login.

Local configuration was inspected as booleans only: an AirNow key is present and `ALLOW_LIVE_API_TESTS=false`. Neither value/configuration was changed. No authenticated or anonymous air-quality data endpoint was called. Public documentation reads are not provider smoke verification. No credential or key-bearing request URL was printed, stored or returned to the browser.

## Capability decision

| Candidate path                        | Official capability evidence                                        | Exact full request/auth/mandatory parameters | Response/time contract                                              | Authenticated execution | Runtime decision                                      |
| ------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `/aq/observation/current/racode/`     | Reporting-area aggregate observations, documented replacement       | **Unverified**                               | **Unverified**                                                      | **Not run**             | Guarded candidate allowlist only; no production codec |
| `/aq/observation/current/ziplatlong/` | Area lookup by location/ZIP, documented replacement                 | **Unverified**                               | **Unverified**, including representative geography                  | **Not run**             | Not implemented; no ZIP walk/location assumptions     |
| `/aq/forecast/current/`               | Current reporting-area forecasts, documented replacement            | **Unverified**                               | **Unverified**, especially category-only/issuance/valid-date fields | **Not run**             | Guarded candidate allowlist only; no production codec |
| `/aq/observation/historical/state/`   | Historical daily area observations by state, documented replacement | **Unverified**                               | **Unverified**                                                      | **Not run**             | No backfill or archive ingestion                      |
| `/aq/forecast/historical/`            | Historical area forecasts, documented replacement                   | **Unverified**                               | **Unverified**                                                      | **Not run**             | No backfill or archive ingestion                      |

The notice dates replacement availability to June 17, 2026 and legacy retirement to September 30, 2026. It requires reviewing changed parameters/response handling, not merely swapping paths. Shutdown behavior itself was not tested. All six legacy ZIP/location routes remain forbidden; tests attempt all of them against the boundary and verify zero transport calls.

The adapter destination allowlist combines the application's existing HTTPS `www.airnowapi.org` restriction with the two officially named candidate paths. This is **not** a verified full URL/auth contract. No production parameter name, auth-field casing, response-field name, missing sentinel, numeric quota, pollutant support or guaranteed retention is inferred from old services. Mock tests use a deliberately named `mockAreaFixture` envelope and `mock_test_key`; those fields are explicitly not an AirNow specification and are never registered at runtime.

## Semantics that are documented

The FAQ distinguishes reporting areas from monitoring sites, describes area observations as aggregate AQI, and notes that forecasts may supply a category without a numeric AQI. It describes general hourly observation/daily forecast cadence and directs clients to per-service quotas. These descriptions justify separate application products; they do not verify any new wire field or guarantee availability for a particular pollutant/date/area.

The FAQ's ZIP-centroid discussion does not establish an official reporting-area polygon or centroid. No such geometry was verified, and `area.geometry` is explicitly null. A rectangular engineering study extent remains only a navigation/query preset. No synthetic or official area symbol is placed at a guessed coordinate.

## Implemented versus blocked

Both new products work as **explicit synthetic sample application fixtures** in the BFF and Map Explorer. They demonstrate aggregate-versus-prediction semantics, opaque area identity, null AQI/category-only forecasts, unknown issuance time, date-only validity, bounded caching and product-specific details. They are not sanitized official payloads, not historical acquisitions and not evidence of live AirNow operation. Their fixed January 2026 dates are labeled in the UI.

Live requests encounter `PROVIDER_NOT_CONFIGURED` without a key or `PROVIDER_CONTRACT_UNVERIFIED` with a key and no codec; no environment flag can register a codec. Historical area products return `PRODUCT_HISTORY_UNAVAILABLE` because no reviewed area archive is configured. The existing station snapshot store is not repurposed for forecasts. There is no implicit fallback to station or sample data.

To enable an official product later, obtain authorized current service specifications, record exact request/auth/response/error/time/quota/geographic semantics, implement a reviewed decoder with a sanitized official example and explicit area membership, then perform one bounded opt-in read-only smoke request. Raise evidence levels only for checks actually completed. A live smoke request still requires a key and explicit opt-in. Prompt 08 may reuse the product identity/provenance/capability boundary; it cannot infer KML or reporting-area geometry from these application fixtures.
