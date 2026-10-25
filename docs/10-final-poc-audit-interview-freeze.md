# Prompt 10 — Final PoC Audit + Interview Freeze

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Freeze candidate  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
Act as independent principal software engineer, GIS QA lead and scientific-data reviewer. Audit the **actual** repository and milestone outputs; fix scoped defects, tests, docs and clearly identified blockers. Do not introduce whole new features. Examine source code and run commands, not merely read prior Codex success summaries. Preserve unrelated changes, and **do not commit or push** unless requested.

## 2. Repository Context
**Greater LA Air Quality Geo Research Platform** — **Interdisciplinary Research & Software Engineering Workbench — v1**. Local-first React/Vite + Express + TypeScript + Zod, user-managed existing Docker PostgreSQL; cloud infrastructure, separate Python services, LLM and advanced source attribution deliberately excluded. Four top-level pages: `/map` Map Explorer, `/analysis` Analysis, `/wildfire` one curated 2025 Eaton Fire Case Study, `/data` Data & Methodology including measured API usage. Initial v1 is a **4–5 minute technical interview demonstration**, not an authoritative regulatory/scientific product. Original prompts 01–09 should have built this progressively; verify real state rather than assuming completion. Prompts 11–12 are **future AI Extension Track** and are NOT dependencies for this freeze.

## 3. Objective
Produce an honestly verified and visually cohesive V1 release candidate, reliable local demo startup with repeatable source-labeled data, solid security/science/test quality and an interview-ready README/demo guide. Freeze only if core acceptance criteria pass; report blockers rather than papering over failures.

## 4. Scope
1. **Repository audit:** source tree cleanliness, package-lock reproducibility, correct environment docs, Node/npm version, npm workspaces, strict TS, Zod at provider boundaries, DB schema/migration safety, no accidental generated bundles or secrets. Check `git diff`, status and dependency audit, prioritize material problems over cosmetic ones.
2. **Local-first readiness:** one-command or concise documented startup using React + Express and existing Docker PostgreSQL. Verify `DATABASE_URL` target isolation, additive migrations, project-only seeds; never reset existing volumes. No production cloud deployment required. `db:seed:sample` and `db:seed:historical-case` must be safe/idempotent and clearly distinguish synthetic from sourced data. Show keyless deterministic demo where possible; ArcGIS remote tiles may still require internet/token, with graceful fallback.
3. **Four-page UI freeze:** Map (compact three selectors, 2D station map, conditional detail drawer); Analysis (one full time-series, up to 3 stations, 24/48/72h, null gaps, summary); Wildfire (one dated historical case, fire perimeter, FHSZ, terrain, limited timeline; optional 3D if real and verified); Data (four internal tabs: source catalog, preview/export, methodology, API usage). No fifth Dashboard, Research Notes, AI Assistant, Settings or duplicated charts. Check 1440px/1280px desktop readability, keyboard/focus, WCAG-related accessible names, error/empty/loading, proper map lifecycle and stateful deep links.
4. **Scientific audit:** AirNow preliminary != AQS vetted data; historical status evidence; AQI != concentration; station != reporting area; forecast != observation; UTC time and DST; measurement/averaging and units; missing != zero; negative raw values handling; FHSZ hazard != real-time risk; historically correct Eaton 2025 incident/study window; archived/final perimeter != hourly fire progression; 2025 LRA map releases might post-date January 2025; no false smoke/traffic source attribution. Verify citations and source URLs. Correct any scientifically misleading UI generated from mockups.
5. **Provider and API usage audit:** verify only current AirNow services (2026 changes); documented/live-tested distinction; cache TTL, stale data, dedup, rate limits, no fan-out storms; in-memory usage metrics count actual outbound attempts and cache hits, label `Since Server Start`, separate ArcGIS browser traffic from BFF metrics and do not advertise billing accuracy. API secrets never in client, logs, README or fixtures.
6. **Data export/lineage:** CSV/JSON against actual bounded datasets with source manifests, provenance and safe escaping; data source catalog `active` status backed by integration evidence. Local stored historical snapshots do not get silently refreshed or recast as Live.
7. **Test suite/CI:** review existing tests for meaningful coverage, remove brittle implementation-specific flakiness but never disable a failing gate. Unit/contract/DB integration/Supertest/RTL/Playwright page flows must run with fixtures and ephemeral CI PostgreSQL. External live tests require opt-in and are excluded from CI. Capture command outputs and actual remote CI state separately.
8. **Performance/security:** one persistent ArcGIS view at a time, no hot loops/polling storms, bounded DB queries and exports, key/referrer restrictions, source URL validation, content encoding, safe server errors, no leaked DB credentials. No fake 100% perfect security claims.
9. **Interview materials:** concise recruiter-first README; representative **real** screenshots (if capture available), 1-page architecture (React -> Express -> providers/local PG), a 4–5 minute demo script, example research questions, at least two STAR/BQ engineering stories about provider normalization and quality gates, explicit 'implemented' vs 'planned' features, and limitations. README should be scannable rather than a 40 KB wall of documentation.
10. **Release metadata:** V1 scope/acceptance matrix, known issues, setup tested environment and a local freeze marker/document; do not tag or commit without permission.

## 5. Technical Requirements
- Do not claim a live workflow was exercised when only fixtures ran. Do not label online basemap as available offline.
- Defect fixes should be small and justified; no repo-wide refactor simply to improve aesthetics.
- Source traceability matters more than a polished but inaccurate map.
- Database migration and seed operations must target only this project's local DB. No destructive resets or backup removal.
- Distinguish P0 core from P1 optional. P1 absent (e.g. 3D/contours) is not automatically a V1 blocker if accurately documented; P0 false scientific claims are blockers.

## 6. Implementation Instructions
Inspect branch and code; write prioritized audit checklist; execute clean install and all quality commands; smoke-test each page using deterministic demo mode and local PostgreSQL; verify optional live paths separately only if credentials permit; repair scoped defects; regenerate outdated screenshots/docs if suitable; rerun all failed gates; prepare release/interview docs. Summarize unresolved blockers instead of masking them. Do not develop AI or high-compute research.

## 7. Testing and Verification
Required: clean `npm ci`; `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run db:status` and migration/seed proof against isolated local/CI DB if available. Test all four page happy/empty/error/deep-link flows, filter selection, chart null-gap and time zones, wildfire case data versions, source links, export payload, API usage counter semantics and secrets. Check that CI is actually green remotely before claiming it. Manually inspect viewport behavior/performance; if screenshots cannot be generated, explicitly say so rather than claiming visual QA complete.

## 8. Acceptance Criteria
- A01: four-page V1 meets approved PRD with minimal duplication, reasonable accessibility and responsive layout.
- A02: a fresh local clone has documented, repeatable startup and isolated existing-Docker PostgreSQL integration.
- A03: live/historical/sample/unavailable status, dataset provenance and scientific limitations are truthful.
- A04: one reproducible historical Eaton case is available; 3D and contours are clearly optional.
- A05: actual API usage and cache statistics, source catalog and bounded exports work.
- A06: tests/CI and 4–5 minute demo evidence are documented; no key leaks, invalid endpoints or unrelated destructive operations.
- A07: no Prompt 11/12 feature is required or falsely advertised as complete.

## 9. Out of Scope
No additional pages, data warehouse, full Southern California historical research, Santa Ana transport model, traffic-source apportionment, computational fluid dynamics, Python microservice, LangChain agent, RAG, AWS/Cloudflare production deployment or new Docker orchestration.

## 10. Final Report
Publish a **PASS / PASS WITH FOLLOW-UP / BLOCKED** V1 freeze review with criterion-by-criterion evidence, files changed, executed tests and exact outcomes, local Docker/migration state, security/source/method issues, screenshots/demo artifacts status, optional vs mandatory omissions, and the smallest remaining repair list. Only call it frozen when all P0 gates pass. Do not commit/push or tag.
