# Prompt 02 — Domain Contracts + Provider BFF

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Local-first  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
You are the senior TypeScript API/data engineer. Inspect the **actual** Prompt 01 implementation and its report before editing. Implement working code, migrations, tests and documents; do not merely advise. Preserve unrelated modifications. Never auto-commit or push. If a live provider contract is unverifiable, isolate that uncertainty and implement a tested fixture-backed path rather than fictional live behavior.

## 2. Repository Context
Product: Greater LA Air Quality Geo Research Platform — Interdisciplinary Research & Software Engineering Workbench v1. Local React/Vite frontend, Express BFF, shared Zod contracts and an **existing local Docker PostgreSQL** deployment are the source of truth; **not** a cloud service and **not** a new Docker stack. Prompt 01 should have established migrations, strict domain semantics, sample fixtures, CI and documented AirNow 2026 changes. Verify, repair minimal dependency blockers, then proceed. V1 pages remain `/map`, `/analysis`, `/wildfire`, `/data`; this milestone implements server infrastructure, **not** the pages.

## 3. Objective
Provide a safe, typed, read-only Express data BFF for station observations with one well-verified AirNow adapter, bounded PostgreSQL-backed snapshot metadata, explicit sample/historical/live modes, caching, provider isolation, and backend API-usage metrics. Make every numerical response traceable to a source, timestamp and measurement unit.

## 4. Scope
1. **Contract refinement:** Monitoring station identity `(provider, nativeSiteId, optional monitor/parameter identity)` with strings and no false aggregation of co-located monitors; pollutant, AQI vs concentration discriminated models; sample period/averaging; observation and fetched timestamps; original source agency vs transport provider; `dataStatus`; complete vs partial result state; `dataMode`; geographical bounds, region presets and error envelope.
2. **PostgreSQL schema (versioned, non-destructive):** bounded `data_sources`, `monitoring_sites`, `observations`, `data_snapshots` and import/provenance metadata as justified. Use safe uniqueness keys that do not erase co-located monitor or differing averaging-period observations. Index read patterns. Keep coordinates as numeric WGS84 initially; PostGIS optional only when already available. Make case-specific imports possible without building a huge AirNow mirror. No raw secret/entire authenticated request URLs in DB.
3. **Provider abstraction:** a single application domain service invokes a read-only AirNow HTTP adapter, performs Zod validation at the trust boundary, maps documented payloads to shared contracts, retains raw-field diagnostics safely, and implements retries/timeout with bounded max. Never let frontend consume provider-specific shapes. The retained `/aq/data/` hourly station route is the starting point, **but verify exact URL/query parameters/response schema with current AirNow documentation and optional authorized live key**; do not assume an old SDK example works. If no key, use strict mock/fixture verification and mark live unverified.
4. **Read-only API**, names may refine to existing conventions: `GET /api/regions`, `GET /api/data-products`, `GET /api/stations?region=...&pollutant=...&mode=...`, `GET /api/stations/:id/observations?pollutant=...&measurementType=...&windowHours=...&mode=...`, `GET /api/datasets`, and safe `GET /api/usage/summary`. Validate query/path inputs with Zod; document response contracts and unsupported combinations. Historical data reads only from an identified local snapshot; sample reads synthetic fixtures/samples; live makes eligible provider calls.
5. **Cache and reliability:** bounded memory cache with canonical keys, in-flight request deduplication, explicit TTL and stale status. Derive TTL from official provider cadence and measured system needs; never call engineering TTL an AirNow mandate. Cache behavior must include the data mode, pollutant, region, requested time and measurement kind; avoid duplicate fetch from map zoom/re-render. On provider error, expose an explicit error/stale indicator and never silently substitute sample data while labeling it live.
6. **Usage instrumenter:** centralized outbound HTTP wrapper records provider name, number of attempts, successful and failed attempts, latency totals/aggregates, plus BFF cache hit/miss counters. `GET /api/usage/summary` returns since-process-start values with `startedAt` and precise definitions. For each provider expose requests, successes, failures, cache hits, optional average latency; cache hit rate denominator must be defined. No raw URLs, API keys, IP addresses or user-sensitive data. DB hits and client-side ArcGIS tile requests are **not** outbound AirNow/AQS requests. The browser ArcGIS service usage must be labeled `not tracked locally` until official billing metrics exist.
7. **Documentation:** `docs/architecture/provider-bff.md`, `docs/data-sources/airnow-live-verification.md` with documented vs actually executed verification, `docs/architecture/data-modes.md`, API usage counting definitions, schema/migration instructions and security model. Add safe `.env.example` values without real keys.

Provider background: https://docs.airnowapi.org/webservices ; https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf ; https://docs.airnowapi.org/faq . The six legacy forecast/location/ZIP endpoints were slated for retirement on 2026-09-30 and must not be introduced.

## 5. Technical Requirements
- Express orchestration layer owns all provider access. No AirNow secret in any `VITE_*` variable, bundle or response.
- Parameterized DB queries. No automatic drops, volume removal or cross-project DB changes. Use existing local PostgreSQL connection; keep CI ephemeral DB independent.
- Treat malformed, missing, delayed, empty, 429 and upstream 5xx separately. Hard limits on bbox, dates, page size and upstream fan-out.
- Retain raw negative concentration values if provider permits; distinguish measured zero and unavailable. Strict AQI vs concentration units; station identity stable.
- Make outbound live calls **explicit**, with provider credentials and opt-in flag for smoke tests; normal local browsing in `sample` and `historical` modes must never unexpectedly call AirNow.
- BFF access logs and usage metrics must not leak tokens. Errors must be actionable without containing secrets.

## 6. Implementation Instructions
Inspect prior schemas and DB state; design minimal migration preserving existing rows; add validation and normalized adapters; implement repositories and source metadata; implement resilient AirNow transport, cache and usage instrumentation; expose routes; create synthetic provider responses only when clearly labeled; document source capability assumptions. Do not implement any frontend page beyond minimal route consumers required for contract verification. Run migrations against a project-isolated DB only.

## 7. Testing and Verification
Use Vitest, Supertest and HTTP mocks to cover: Zod reject of invalid bbox/mode/date; station ID containing zeroes/letters; co-located monitors; AQI/concentration differences; partial observations; missing/zero/negative; provider 429/500/timeout; retries; cache key isolation, TTL, dedup and stale responses; sample never triggering live calls; migration repeatability; SQL safety; no key exposure; exact outbound request count on hit/miss/retry; process-start summary. CI must work without any real external keys. Optional `ALLOW_LIVE_API_TESTS=true` with provided key may validate a small read-only query and record response field evidence (sanitized).

## 8. Acceptance Criteria
- A01: full read-only BFF returns **normalized, source-grounded** observations and safe metadata for sample and any verified live mode.
- A02: isolated PostgreSQL tables/migrations and bounded snapshot store work without data loss.
- A03: cache and request coalescing demonstrate reduced actual outbound requests in tests.
- A04: `/api/usage/summary` faithfully distinguishes outgoing attempts from cache hits and uses actual measured counts.
- A05: provider errors and unavailable states are truthful; no hidden sample fallback.
- A06: tests, typecheck, lint, build and CI-equivalent checks pass; live capabilities unverified are explicitly declared.

## 9. Out of Scope
No ArcGIS station map, time-series chart, reporting-area/forecast UI, official KML contours, wildfire case study, historical multi-year collection, scraping, Cloud deployment, AI Agent, vector database or full observability infrastructure. These belong to later prompts.

## 10. Final Report
List files/migrations changed, domain endpoints/contracts, real vs mocked AirNow verification, cache/usage metric definitions, DB verification, tests executed with results, errors/open questions, acceptance status and dependencies for Prompt 03. **Do not auto-commit/push.**
