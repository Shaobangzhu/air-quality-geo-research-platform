# API usage counting definitions

`GET /api/usage/summary` is in-memory, since process start. `startedAt` is the UTC creation time of the runtime usage instrumenter. Restarting the API resets counters; no durable billing or production observability claim is made.

| Metric            | Exact definition                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Provider requests | Completed outbound HTTP attempts, including retries, through the centralized wrapper                          |
| Successes         | HTTP 2xx with bounded body read and successful decoder validation; a valid empty payload is success           |
| Failures          | Every other completed attempt: network, timeout, rejected/429/5xx, malformed/oversized body or failed decoder |
| Total latency     | Measured attempt duration through body read and decoder validation; excludes retry backoff                    |
| Average latency   | total latency / completed requests; null with zero requests                                                   |
| Cache hit         | Fresh memory-cache return                                                                                     |
| Cache miss        | One started load/revalidation; failed loads still count                                                       |
| Coalesced request | A caller that joins an already in-flight key; separate from hit/miss                                          |
| Stale response    | A failed revalidation served within the same key's stale grace; counted for each served caller                |
| Hit rate          | hits / (hits + misses), excluding coalesced callers; null for zero denominator                                |

For every provider, successes + failures = requests. A contract/key failure before HTTP is a live cache miss but **zero** outbound requests. Cache decisions are additionally grouped by application mode. Only live cache decisions are attributed to the AirNow provider entry; sample fixtures and historical DB reads never increase AirNow/AQS request or provider-cache counters merely because a historical source originated there.

The current registry exposes AirNow/AQS entries (AQS has no implemented transport). ArcGIS browser/tile usage is explicitly `not tracked locally`; no local counter estimates Esri billing. OpenAI is outside this BFF milestone and is never called.

The response contains no raw URL, query, API key, source IP or per-user identifier. Provider error messages/bodies are not retained. Documentation reads performed during development do not flow through or increment the application's provider metrics.

Deterministic tests demonstrate one concurrent load for 20 callers, one retry (two mocked fetch attempts: one failed, one successful), then a fresh cache hit with no extra attempt. Those are exact **mock HTTP invocation counts**, not live AirNow usage measurements. Production AirNow attempts remain zero while the contract guard is active.
