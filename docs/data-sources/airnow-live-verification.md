# AirNow hourly capability and verification — 2026-10-25

## Official evidence actually inspected

The [official service catalog](https://docs.airnowapi.org/webservices) documents hourly monitoring-site observations. The [June 2026 migration notice](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf) lists `/aq/data/` as retained and gives the six legacy retirement/replacement mappings. The [FAQ](https://docs.airnowapi.org/faq) describes general observation cadence, per-service quota documentation and bounded caching recommendations. The six scheduled-retired routes remain forbidden.

The publicly accessible catalog HTML showed capability descriptions and a login link, but no detailed hourly request parameters/response definitions. Search did not locate an accessible current official wire specification. Secondary library examples were found but **were not used as an authoritative contract**, especially where descriptions differed. An API key is not a documentation-site login.

| Item                                                                               | Evidence level / outcome                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/aq/data/` exists in the retained service family                                  | **Officially documented**                                    |
| Hourly monitoring-site observations, AQI/concentration capability                  | **Officially documented**                                    |
| Exact request parameter names/values/requiredness and casing                       | **Unverified**                                               |
| Exact response fields, identity, units, missing markers and UTC/period conventions | **Unverified**                                               |
| Endpoint numeric quota, retained date range and full Greater LA coverage           | **Unverified**                                               |
| AirNow key presence                                                                | Checked locally as present; value never printed              |
| ALLOW_LIVE_API_TESTS                                                               | Read as false; not changed                                   |
| Authenticated hourly API request                                                   | **NOT RUN**                                                  |
| Production payload field evidence                                                  | None; no payload fields are claimed                          |
| Synthetic codec/HTTP timeout/retry/cache/normalization boundary                    | Deterministically tested; **not** official wire verification |

## What is implemented

`AirNowHourlyAdapter` checks a server key and registered codec before attempting transport. The runtime deliberately registers no codec. An explicit live query therefore returns HTTP 503 / `PROVIDER_CONTRACT_UNVERIFIED`, with no sample fallback and zero outbound attempts. Missing keys instead return `PROVIDER_NOT_CONFIGURED`.

The extension seam accepts a reviewed request builder and decoder. It restricts the resulting destination to HTTPS `www.airnowapi.org/aq/data/`, forbids redirects and validates decoded domain batches through Zod. No guessed parameter/response schema is shipped. Tests inject an explicitly labeled synthetic codec and mocked HTTP; it is not selected through an environment flag or shipped as the production codec.

The working sample import/normalizer is independent of AirNow wire representation. It demonstrates scientific identity, provenance, raw-value preservation and partial results without pretending synthetic JSON is an AirNow response.

```sh
npm run provider:airnow:smoke
```

With the current flag this prints NOT RUN and exits 2 without provider traffic. If opted in before the codec is reviewed, it still exits with `PROVIDER_CONTRACT_UNVERIFIED`; the flag cannot fabricate evidence or enable guessed behavior. This scaffold is an explicit verification gate, not a claim of an implemented live query.

## Evidence needed to enable live

Obtain the current official per-service documentation or an authorized documentation session. Record exact request and response definitions, time semantics, identity/monitor distinctions, units and errors/limits. Implement that codec with a sanitized official response fixture; then run one explicitly opted-in, bounded read-only query and record actual status/field names/types/record count without a key-bearing URL or raw credentials. Compare source IDs/period semantics rather than matching stations by coordinates. Update the capability evidence level only after execution succeeds.

No AirNow, AQS, ArcGIS or OpenAI authenticated request was made in this milestone. No historical or live numeric result was acquired or invented.
