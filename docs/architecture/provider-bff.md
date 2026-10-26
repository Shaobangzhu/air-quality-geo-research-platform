# Station observation BFF — milestone 02

The Express BFF owns data modes, provider access, normalization, cache, snapshot persistence and usage counting. The browser receives application contracts from `@aq/contracts`; it never receives a provider response or a server credential. This milestone adds server infrastructure, not the four planned page implementations.

The current production AirNow boundary is deliberately **contract-unverified**. `/aq/data/` is documented as retained, but the accessible official catalog did not expose the detailed parameters/response schema. No external query fields or AirNow payload fields were guessed. `AirNowHourlyAdapter` has an injected-codec seam tested with an explicitly synthetic codec; the runtime registers no codec and returns `PROVIDER_CONTRACT_UNVERIFIED` before any HTTP attempt. See [verification evidence](../data-sources/airnow-live-verification.md).

## Endpoints and contracts

All public operations are GET. Region, product, dataset, station, observation, usage and error shapes have shared Zod schemas. Invalid inputs return a static, typed error without reflecting their values.

| Route                            | Response / behavior                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/api/health`                    | API liveness, safe DB connectivity and configured-mode capability; no provider request                                         |
| `/api/regions`                   | `regionsResponseSchema`; three frozen EPSG:4326 engineering study presets                                                      |
| `/api/data-products`             | `productsResponseSchema`; station observations only, with explicit mode limitations                                            |
| `/api/analysis-series`           | `analysisSeriesResponseSchema`; one bounded batch, at most three compatible series, explicit missing slots and source coverage |
| `/api/reporting-area-aqi`        | Separate aggregate AQI application result; synthetic sample or explicit official-product unavailability                        |
| `/api/forecasts`                 | Separate prediction result with issuance/validity precision; synthetic sample or explicit unavailability                       |
| `/api/station-readings`          | `stationReadingsResponseSchema`; latest supplied revisions per metric for the map, reusing the existing bounded batch cache    |
| `/api/stations`                  | `stationsResponseSchema`; monitoring identities discovered in the selected observations                                        |
| `/api/stations/:id/observations` | `observationsResponseSchema`; one station plus normalized observation revisions                                                |
| `/api/datasets`                  | `datasetsResponseSchema`; local snapshot metadata, static source evidence levels and the synthetic fixture descriptor          |
| `/api/usage/summary`             | `usageSummarySchema`; completed HTTP attempts and cache counters since process start                                           |

Station queries accept only:

| Input             | Default / bound                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `region`          | `greater-la`; also `coastal-la`, `inland-empire`; no arbitrary regions                     |
| `pollutant`       | `PM2.5`; also `O3`, `PM10`                                                                 |
| `measurementType` | `concentration`; also `aqi`                                                                |
| `mode`            | Server `DATA_MODE`; explicit `sample`, `historical`, `live` overrides                      |
| `windowHours`     | 24; integer 1–72; an application bound, not a provider retention claim                     |
| `endAt`           | Valid UTC ISO instant at an hour boundary; dates 1970–2100; live cannot request the future |
| `bbox`            | Selected preset; optional `west,south,east,north` subset, with ordered valid coordinates   |
| `snapshotId`      | Required UUID only in historical mode; forbidden in other modes                            |
| `limit`, `offset` | 200 / 0; maximum 500 / 1999                                                                |

Intervals are `[from, to)`. Equivalent UTC spellings are canonicalized. Sample defaults to the fixed fixture end `2026-01-15T21:00:00Z`; historical defaults to the identified snapshot end; live would default to the previous UTC hour. Historical intervals outside the snapshot fail explicitly. These defaults are engineering choices and do not imply source availability.

`/api/datasets` accepts only optional `mode`, `limit` (1–20) and `offset` (0–31). Metadata routes reject unknown query fields. Duplicate query keys/arrays, extra credential parameters, invalid dates and unbounded extents are rejected. Station paths accept an opaque `s_…` identifier returned by discovery; native IDs are never assumed numeric or used directly as SQL/path identifiers.

Examples without credentials:

```sh
curl 'http://127.0.0.1:3001/api/stations?mode=sample&pollutant=PM2.5&measurementType=concentration'
curl 'http://127.0.0.1:3001/api/datasets?mode=historical'
curl 'http://127.0.0.1:3001/api/usage/summary'
```

Use a discovered opaque station ID for the observations route. A valid ID absent from the chosen mode/pollutant/window gives `STATION_NOT_FOUND`; an invalid ID is `INVALID_REQUEST`.

## Scientific semantics

A station identity is `(provider, nativeSiteId, monitorId|null, parameterId|null)`, with all identifiers retained as strings. Its stable opaque ID is a SHA-256-derived value. Latitude/longitude is not an identity or an aggregation key; co-located monitors remain distinct.

An observation revision ID includes station identity, time, measurement kind/pollutant/unit, the full averaging-period semantics, raw/normalized values, status and source agency. Exact duplicates are diagnosed and deduplicated; conflicting supplied revisions remain separate and make the result partial. Snapshots retain different revisions across acquisitions. No numerical averaging, AQI computation, clipping or unit conversion is performed.

`dataStatus` is preliminary/validated/unknown, independent of `dataMode`. AirNow may not be labeled validated. Original source agency is separate from transport provider. Every number retains measurement unit, raw value/unit/parameter/qualifier, observed/fetched UTC and source provenance. Null remains missing, zero remains zero and negative concentrations survive.

`complete` means the supplied batch had no rejected/conflicting/null records or response warnings; it does not prove continuous temporal coverage or complete regional monitoring. `partial` is explicit. `empty` is a valid zero-row selection, not a provider outage. Missing timestamps remain gaps; the BFF never fills them with zeroes. Diagnostics describe the source batch, including safe rejected row indexes, rather than inventing an expected station/hour census.

Response metadata contains requested window/bbox, available source coverage, latest selected observation, original fetch time, source ID, optional persisted snapshot ID, pagination and cache status. A live result older than two hours relative to the requested end gets a `delayed-observations` warning; this is an engineering indicator, not an AirNow SLA. It is null for sample/historical or empty data.

## Cache and provider isolation

There is one application service. A single bounded region load supplies both station discovery and station observations. Caller sub-bboxes, station selection and pagination filter that shared result instead of causing new provider fan-out. The three engineering presets share the parent Greater LA acquisition; requested preset bounds clip the cached batch. Cache identity includes data mode, parent region/upstream bbox, pollutant, measurement kind, requested time/window and historical snapshot ID.

The LRU cache holds at most 32 entries / 8 MB with at most four distinct in-flight loads. Identical concurrent loads join one promise. Default TTL is 300 seconds with 900 seconds of stale grace. The [official AirNow FAQ](https://docs.airnowapi.org/faq) describes generally hourly observation updates and recommends caching; these TTL values are initial engineering choices, not mandated quotas. Production tuning remains unmeasured. Mock tests demonstrate reduced HTTP invocation counts under concurrent callers and cache hits.

After TTL expiry, the BFF revalidates. On failure it may return the same-mode cached result only within its grace period, retaining original fetch/expiry times and exposing `cache.status=stale`, `staleReason`, partial state and warning. It does not extend freshness on failure or substitute sample data. After the grace period, the error is returned. Caller mutations cannot change cached objects.

The centralized HTTP wrapper caps body size at 2 MB, timeout at 10 seconds/attempt and attempts at three (defaults 3 seconds/two attempts). Backoff is bounded. A long Retry-After ends the bounded request instead of retrying early. Redirects are rejected. HTTP rejection, rate limit, 5xx, timeout/network, non-JSON, oversized and invalid-schema errors are distinct; valid empty payloads are successful attempts. No raw provider error body, URL or exception is exposed.

## PostgreSQL and snapshot bounds

`002_station_bff.sql` adds `data_sources`, `monitoring_sites`, `observations`, `data_snapshots`, and `snapshot_imports` within the existing project-owned `aq_workbench` schema. It preserves `001_foundation.sql` and its rows. Coordinates remain numeric WGS84; no PostGIS or new Docker service is required.

Runtime values use bind parameters, including bulk JSON recordsets. Snapshot content hashes make repeat imports idempotent. Snapshot-time station metadata is retained independently of the mutable current station registry. Observation uniqueness is per snapshot and revision, so co-location, averaging periods and conflicting revisions are not silently collapsed.

The repository uses a transaction/advisory lock and permits at most 32 snapshots, 512 registry identities and 2,000 observations per snapshot (at most 64,000 observation rows). Snapshot intervals are at most 72 hours. Capacity exhaustion refuses a new import and removes nothing. No automatic DELETE/DROP/TRUNCATE/volume reset exists. For future verified live capture, a full/unavailable store produces `snapshot-not-persisted` and a safe `persistenceError` code while the memory result retains its provider provenance; it is never reclassified historical automatically.

```sh
npm run db:migrate
npm run db:migrate
npm run snapshots:import -- --file fixtures/synthetic/bff-hourly.json
npm run test:db:local
```

Sample browsing does not require a DB and does not auto-import fixtures. Historical browsing reads an identified curated local snapshot only. See [data modes/import rules](data-modes.md) and [existing container ownership](database.md).

## Errors, security and usage

Errors follow `{ error: { code, message, retryable } }`. Validation/range/snapshot-required errors use 400; missing stations/snapshots 404; wrong snapshot mode/full import store 409; provider rejection/server/network/format/schema errors 502; unavailable DB/provider/contract and rate limiting 503; upstream timeout 504. Failed snapshot persistence is an explicit warning on otherwise usable future live data.

AirNow/AQS/OpenAI secrets remain server-only. Source references are credential-free official HTTPS references with no query/userinfo, or the named synthetic fixture identifier. Normalization rejects reflected configured secrets and credential query fragments. Unknown raw objects are never persisted as diagnostics. No access logs with URLs, keys or client IPs are introduced. The browser ArcGIS credential exception and its future SDK integration remain unchanged.

Usage semantics, including the precise cache denominator and HTTP latency definition, are documented in [API usage](api-usage.md). DB queries and client ArcGIS tile calls are not counted as outbound AirNow/AQS calls.

## Milestone 04 map read

`/api/station-readings` uses the same query schema/cache/repository as station discovery. It returns each available identity with all latest supplied revisions separately for AQI and concentration; ties retain different periods/conflicts. A missing latest value never selects an older non-null value. The requested metric controls the upstream query/cache key; a counterpart appears only if actually present in that batch. No second provider fetch or AQI computation is used to fill it. Response schema bounds/validates IDs, source/mode, coordinates and requested context. See [map semantics and provenance](../frontend/station-observations.md).

Milestone 05 defines region bounds, canonical pollutant/provider code handling and linked selection in [Map interaction contract](../frontend/map-interactions.md). Snapshot/batch region identity remains `greater-la`; response metadata identifies the selected subpreset.

Milestone 06 adds [Analysis series](../frontend/analysis-series.md). Its strict query accepts only 24/48/72-hour windows and up to three unique IDs, reusing acquisition/cache and bounded snapshot reads. Historical Analysis alone permits a partial window before acquired coverage; it never extends beyond the snapshot end or creates observations. Other station endpoints keep their full-window guard.

Milestone 07 uses a separate [reporting-area service and bounded cache](../frontend/reporting-area-products.md), sharing usage/HTTP controls without mixing records into the station batch/repository. Catalog mode labels distinguish synthetic-only products from unverified official capabilities. No new provider wire fields or database schema were introduced.
