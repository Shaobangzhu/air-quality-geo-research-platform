# Provider capabilities and verification

Verified against official documentation on **2026-10-25**. Documentation access is not a successful API request. **No provider endpoint was live-tested.** No adapter is implemented. Internal Zod schemas are application contracts, not claims about external response fields.

Evidence levels: **officially documented** = capability stated by the owner; **detailed contract verified** = named request/response details inspected; **live-tested** = an actual bounded authenticated request succeeded; **unverified** = no such evidence. These levels are independent: reading documentation does not prove credentials, availability, coverage or quota.

## AirNow

The [service catalog](https://docs.airnowapi.org/webservices) documents these products. The [June 2026 migration notice](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf) identifies the new/retained paths below. Each path/capability is **officially documented**; each detailed request/response contract is **unverified** here; each live test is **unverified / not run**.

| Path                                  | Capability / identity                          | Migration |
| ------------------------------------- | ---------------------------------------------- | --------- |
| `/aq/data/`                           | Hourly site observations; AQI/concentration    | Retained  |
| `/aq/dailydata/`                      | Daily site observations within bbox            | New       |
| `/aq/observation/current/racode/`     | Current reporting-area observations            | New       |
| `/aq/observation/current/ziplatlong/` | Geographic lookup of current area observations | New       |
| `/aq/forecast/current/`               | Current area forecasts                         | New       |
| `/aq/observation/historical/state/`   | Historical daily area observations by state    | New       |
| `/aq/forecast/historical/`            | Historical area forecasts                      | New       |
| `/KML/PM25/`                          | PM2.5 contours                                 | Retained  |
| `/KML/Ozone/`                         | Ozone contours                                 | Retained  |
| `/KML/Combined/`                      | Combined contours                              | Retained  |

The notice announced six replacements for June 17, 2026 and scheduled six legacy services for retirement on **September 30, 2026**, now past. Actual shutdown behavior was not tested. **Never implement these legacy paths:**

| Scheduled-retired legacy path         | Replacement family           |
| ------------------------------------- | ---------------------------- |
| `/aq/forecast/zipCode/`               | `/aq/forecast/current/`      |
| `/aq/forecast/latLong/`               | `/aq/forecast/current/`      |
| `/aq/observation/zipCode/current/`    | Current racode or ziplatlong |
| `/aq/observation/latLong/current/`    | Current racode or ziplatlong |
| `/aq/observation/zipCode/historical/` | Historical state             |
| `/aq/observation/latLong/historical/` | Historical state             |

The notice warns that parameters and response handling can change; swapping a legacy URL is insufficient. It is not a full endpoint contract. The unauthenticated catalog available during this task did not expose detailed service specifications. Before Prompt 02 adapters: inspect the current per-service documentation/query tool, record exact parameter names/types/requiredness, response schema, units, time basis, error/empty behavior, geographic bounds, request limits and provenance rules. Do not infer these from old examples, file products or the internal contracts. **No parameter names, response fields, numeric rate limits or guaranteed historical retention are asserted for these routes.**

The [official FAQ](https://docs.airnowapi.org/faq) makes per-service quota documentation authoritative and recommends bounded cached access; do not loop through ZIP codes to build a reporting-area database. Numeric limits remain unverified per route. The [AirNow policy](https://docs.airnowapi.org/) describes observations as preliminary; official regulatory historical sources are AQS/AirData. These policy claims are **officially documented**. Keys remain server-only, and future live tests require explicit `ALLOW_LIVE_API_TESTS=true` plus credentials. No request is automatically made by startup/tests.

## EPA AQS / AirData

| Claim                                                                                                                                            | Evidence                                                                                                                                           | Limits                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| AQS provides row-level samples, monitor metadata and summaries; AirData offers bulk/aggregated access                                            | **officially documented** — [AQS API](https://aqs.epa.gov/aqsweb/documents/data_api.html), [AirData](https://www.epa.gov/outdoor-air-quality-data) | Not real-time; no acquisition implemented           |
| Sample queries support site/county/state/CBSA/bbox selection; request credentials are email/key; state/county/site codes preserve leading zeroes | **detailed contract verified** — AQS request-variable and service tables                                                                           | Full normalized response mapping **unverified**     |
| Daily summaries use source local-day aggregation                                                                                                 | **officially documented** — AQS service overview                                                                                                   | Conversion/DST behavior must be checked per product |
| Credential validity, Greater LA coverage, record quality and live responses                                                                      | **unverified**                                                                                                                                     | No live test or snapshot exists                     |

Do not automatically label all AQS rows validated; inspect quality/completeness evidence when curating. Keep `AQS_EMAIL` and `AQS_API_KEY` server-only. No AQS rate-limit number is encoded here.

## CAL FIRE

| Source / capability                                                                               | Evidence                                                                                                                                                                   | Required later verification                                                                                      |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| FRAP historical fire perimeter dataset; incomplete records and possible geometry/attribute errors | **officially documented** — [CAL FIRE perimeters](https://www.fire.ca.gov/what-we-do/fire-resource-assessment-program/fire-perimeters)                                     | Dataset release/item, layer ID, fields, CRS, query/download limits and attribution: **unverified**; no live test |
| SRA Fire Hazard Severity Zones; official page identifies the April 1, 2024 effective dataset      | **officially documented** — [OSFM FHSZ](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/%E2%80%8Cfire-hazard-severity-zones)            | Exact service contract/version: **unverified**; no live test                                                     |
| LRA FHSZ recommendations, separate from SRA and subject to local adoption context                 | **officially documented** — same OSFM page, reached from [community wildfire program](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/) | Local adoption and specific layer/item contracts: **unverified**; no live test                                   |

FHSZ describes longer-term physical fire hazard; it is not current spread or smoke exposure. Preserve jurisdiction and release metadata rather than merging SRA/LRA indiscriminately. No specific ArcGIS service URL, field or download availability is assumed from a viewer's existence.

## ArcGIS

| Capability / integration                                                     | Evidence                                                                                                                        | Limits                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Basemap styles/data, vector/map tiles and web maps                           | **officially documented** — [Basemap Styles service](https://developers.arcgis.com/rest/basemap-styles/)                        | Requires account/auth context; no service contract/live request tested; offline availability not promised |
| Elevation for input locations with explicit vertical units/reference choices | **officially documented** — [Elevation service](https://developers.arcgis.com/rest/elevation/)                                  | Exact request mapping, entitlements and Greater LA resolution **unverified**; no terrain query            |
| React 19/Vite npm component integration                                      | **detailed contract verified (integration guide only)** — [React guide](https://developers.arcgis.com/javascript/latest/react/) | Not installed, rendered or live-tested in this milestone                                                  |
| SDK 5.1 release and component direction                                      | **officially documented** — [release notes](https://developers.arcgis.com/javascript/latest/release-notes/)                     | Recheck supported release before Prompt 03                                                                |

The official React guide installs `@arcgis/map-components`, `@arcgis/core`, `@esri/calcite-components`; registers `@arcgis/map-components/components/arcgis-map`; and supplies TSX declarations through `@arcgis/map-components/types/react`. React 19 events use `onarcgisEventName`. Component events coordinate lifecycle. Current release notes recommend components and deprecate widgets as of 5.0. Do not copy an older widget setup unquestioningly. Registry inspection found core/map-components **5.1.27**, but no SDK dependency is needed for the foundation and no runtime integration has been verified.

A browser ArcGIS credential is public by design: restrict referrers, service privileges and entitlements. This exception does not apply to AirNow/AQS/OpenAI server credentials. Pricing, account quotas and individual layer access were not validated; no paid requests were made.

## Follow-up evidence checklist

For each future adapter, attach the exact official specification URL and review date, a bounded credential-redacted opt-in test result (or explicit blocker), a captured response fixture with provenance, and contract tests for missing/error/time/unit semantics. Do not upgrade any evidence level merely because a link exists. Authentication, service availability and scientific fitness remain separate questions.
