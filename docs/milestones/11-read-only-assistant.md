# Prompt 11 — read-only Research Assistant

Baseline: `eef45b7` (V1 freeze audit). User explicitly selected Prompt 11 on October 29, 2026. The original implementation was verified offline; a separately authorized paid smoke subsequently passed as recorded below. No schema migration, container change or Prompt 12 work.

## Acceptance

| Criterion                           | Result                                  | Evidence                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 bounded read-only queries       | PASS offline                            | Three preset questions route through one LangChain tool into existing `BffService.analysis`. Mock model → actual tool → fixture service → typed API and React rendering tested. Sample and existing historical snapshots only; no Live provider or snapshot writes.                                                                                  |
| A02 resolvable numeric evidence     | PASS                                    | Fixed answer templates, direct rendering of deterministic ranges/counts; citations resolve to returned station series with exact record IDs, units, periods, status and source lineage. Existing strict analysis schema validates numeric summaries and UTC alignment. Unknown citations, modified numeric evidence and mismatched context rejected. |
| A03 secrets and ceilings            | PASS within local scope                 | Server-only key; fixed endpoint/logging off; no arbitrary URL/SQL/code/write tool. Strict body/context/tool schemas, one call/tool, token/time/concurrency/rate/row/byte bounds. Current-asset configured-secret comparison has zero hits; no perfect-security claim.                                                                                |
| A04 four-page V1 without key        | PASS                                    | Collapsed Analysis panel makes no request; expansion checks status; disabled button without configured feature/key. Existing charts and four routes retained. Existing passive-fetch regression caught and repaired before completion.                                                                                                               |
| A05 offline quality / optional live | PASS locally; live and remote follow-up | Offline model, domain, API and React tests plus all V1 regressions. CI explicitly disables both extension and live LLM smoke. No paid call or remote CI for uncommitted changes claimed.                                                                                                                                                             |

## Implementation inventory

- Shared request/response contracts: `packages/contracts/src/assistant.ts`, exported through built contracts.
- Domain orchestration and one tool: `apps/api/src/assistant/service.ts`. `get_selected_station_series` accepts only a strict intent enum; context is bound and independently validated by the server. Summary, missingness and compatible range comparison reuse V1 calculations. No model arithmetic or narrative numbers are rendered.
- SDK adapter: `apps/api/src/assistant/model.ts`; exact `@langchain/core` 1.3.1 and `@langchain/openai` 1.8.0, transitive OpenAI SDK 7.45.1; centrally pinned `gpt-4.1-mini-2025-04-14`.
- API/config/startup: research status and answer routes, optional feature flag, fixed safe failures, no external tracing. The existing AirNow/AQS usage explanation explicitly excludes OpenAI calls and costs.
- Analysis UI: optional contextual panel, disabled/configured state, preset question, response status, citations and expandable source records; responses reset when Analysis context changes. Source statuses and averaging interpretation remain visible.
- Verification: assistant service/API tests, SDK-boundary tests, React tests and disabled-key Chromium test; `scripts/research-smoke.ts` / `npm run research:smoke` requires explicit `ALLOW_LIVE_LLM_TESTS=true` and a key.
- Setup/reference: `.env.example`, CI/Playwright flags, README and [assistant architecture](../architecture/research-assistant.md). The original V1 freeze evidence is preserved as a historical baseline.

## Limits and evidence strategy

One supported question per request; 1–3 selected stations, fixed engineering region and metric, pinned 24/48/72-hour interval, at most 500 source records and 1 MB response. One model call, one tool, zero retries, 512 output tokens, a 3,072-byte static input envelope with framing reserve under the 4,096-token budget, 12-second SDK timeout and 15-second response deadline. Two active executions and six admitted requests/minute per local process; abandoned dependencies retain their active slot until settled.

The model receives only static instructions, tool schema and a preset question. It does not see source records or get a second turn. Tool results remain untrusted and must pass existing scientific schemas plus request-context and configured-secret checks. All numeric UI facts come directly from returned evidence, not generated prose. Unsupported questions/Live/unpinned history are refused before model invocation; wrong tools, malformed arguments, failures and exceeded bounds produce no invented evidence.

This intentionally narrow design does not support arbitrary natural-language questions, regional highest-AQI rankings, averages, 12-hour windows, forecasts, conversions, document RAG, ingestion or causal claims. Historical AQS row certification remains unknown; sample remains synthetic. It verifies consistency with supplied data, not environmental truth or perfect hallucination prevention.

## Executed checks

The verification logs are local `/private/tmp/aq11-*.log`; they contain command summaries, not provider keys. Final outcomes are recorded here after execution:

| Check                               | Outcome                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript                   | PASS                                                                                                                                                                |
| Unit/API/React suite                | PASS — 216 tests / 26 files (193 existing + 23 extension tests)                                                                                                     |
| PostgreSQL integration              | PASS — 6 tests / 3 files against confirmed `air_quality_geo_research_test`; no infrastructure mutation                                                              |
| Production build                    | PASS — existing large ArcGIS chunk warning remains                                                                                                                  |
| Configured server-secret scan       | PASS — zero matches in 1,121 current browser assets and tracked/nonignored text; eight configured secret fields compared; deliberately public ArcGIS token excluded |
| ESLint / Prettier                   | PASS                                                                                                                                                                |
| Chromium browser regression         | PASS — 20 tests, including all 19 V1 flows and the disabled assistant flow                                                                                          |
| Final diff / immutable V1 artifacts | PASS — no whitespace errors; no migration or historical fixture changes                                                                                             |
| Paid live smoke                     | NOT RUN — opt-in left disabled; no account/model availability or measured paid cost claimed                                                                         |
| Remote CI                           | NOT RUN for these uncommitted changes; configured offline gates are not remote execution evidence                                                                   |

During development, UI tests initially needed explicit fixture injection in the browser test environment; that was corrected. The existing V1 no-extra-fetch test also caught eager assistant configuration loading; checking status only after panel expansion restored the constraint. No failing test was disabled.

## Remaining work and Prompt 12 boundary

### Authorized live verification — October 29, 2026

Against local commit `9f56db3`, one explicitly authorized `ALLOW_LIVE_LLM_TESTS=true npm run research:smoke` execution succeeded at approximately 22:44 UTC. The pinned OpenAI model selected the validated read-only tool and the sample workflow returned `partial` with one resolvable evidence citation. The response reported 150 input tokens and 16 output tokens; actual billing was not inspected. `partial` reflects gaps in the synthetic data, not a failed model call. The test used sample data, did not connect to PostgreSQL, and did not enable the UI feature or change persistent configuration. This single case does not validate all supported questions, real environmental data or provider availability.

OpenAI's [model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini) now marks the pinned `gpt-4.1-mini-2025-04-14` snapshot deprecated. A model migration and its own tests remain future work; this verification used the existing configured model.

No live integration is required for deterministic CI. Before demonstrating actual model routing, deliberately enable the feature/key and optionally run the gated smoke; inspect the sanitized status and actual token counts. AirNow/AQS metrics exclude these LLM calls, and no dollar estimate is advertised. Current local review does not verify account permissions, distributed abuse controls, full browser accessibility or provider billing.

Prompt 12 is a separately selected milestone. It needs approved document provenance, retrieval/evidence contracts and an evaluation corpus; no vector store, embedding, retrieval, memory or fifth page has been added here. No infrastructure or autonomous write capability is needed for this extension.
