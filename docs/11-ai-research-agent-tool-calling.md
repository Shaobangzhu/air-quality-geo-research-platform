# Prompt 11 — AI Research Agent + Tool Calling

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** **Future AI Research Extension** (not needed for V1 interview freeze)  
**Recommended Codex effort:** High

## 1. Role and Execution Mode
You are a senior TypeScript AI application architect and scientific quality engineer. **Do not start this milestone until the user explicitly selects Prompt 11.** Once selected, inspect the real repository, the V1 freeze/acceptance report, existing scientific contracts, Express domain services and data provenance. Implement working code, tests and docs with strict read-only safety; never auto-commit/push. Verify **current** LangChain.js/OpenAI SDK APIs and avoid deprecated recipes.

## 2. Repository Context
Greater LA Air Quality Geo Research Platform: four-page local-first React+ArcGIS / Express+TypeScript / user-managed Docker PostgreSQL research PoC. AirNow near-real-time observations are preliminary, historical AQS/AirData and curated Eaton fire case are separate. V1 freeze Prompt 10 must remain intact; this is a separate AI Extension Track. There must be **no fifth mandatory top-level AI Assistant page**. Add a compact, optional contextual Research Assistant drawer/panel within Analysis (or Wildfire Case Study where appropriate), with a clear disabled/configuration status when `OPENAI_API_KEY` is absent.

## 3. Objective
Create a **bounded, read-only, evidence-grounded environmental research agent** that orchestrates existing deterministic domain services via LangChain.js and OpenAI, returns a typed response with verified observation/source references, and demonstrates real testing/quality engineering. Do not create a generic unconstrained chatbot.

## 4. Scope
1. **Current framework:** evaluate official https://docs.langchain.com/oss/javascript/langchain/agents and https://docs.langchain.com/oss/javascript/integrations/chat/openai plus current OpenAI model/API docs at execution time. Use supported stable LangChain.js tool APIs, a minimal agent abstraction and Zod. No automatic LangGraph unless task genuinely requires stateful workflow.
2. **Architecture:** Express BFF -> Agent orchestration -> strictly read-only tool wrappers -> **existing** air-quality/domain services -> provider/cache/local PostgreSQL; no direct AirNow/AQS calls from model tools. No Python AI microservice, separate Docker service or duplicate provider adapters.
3. **Question scope:** a small list such as 'Which available stations had highest PM2.5 AQI within this region/time window?', 'Compare selected PM2.5 station observations over the last 12h', 'Which observations are stale/missing?', 'What is the verified reporting-area forecast?' *only when existing services support the specific query*. Unsupported questions must yield `insufficient evidence/unsupported`, not invented results.
4. **Tools** grounded in actual services, e.g. `get_station_observations`, `get_station_time_series`, `compare_selected_stations`, `get_reporting_area_forecast`, `get_data_provenance` **only as implemented**. Every tool has a strict Zod input contract with bounded region/bbox, pollutant, station IDs, max stations, row count and time span. Prevent free-form SQL, arbitrary URL fetching, file writes and code execution.
5. **Deterministic numeric processing:** aggregation, sorting, temporal alignment, unit conversion (only supported explicit conversions), sample size, missingness and average calculations performed in tested TS services. Do not ask an LLM to compute statistics from raw text. Distinguish unweighted station mean from official regional AQI. AirNow concentrations/NowCast AQI are not equivalent.
6. **Typed response schema:** question, short answer, `evidence[]` with stable references to actual tool-returned observations/aggregates, `citations[]` (type `data`, IDs must resolve to returned evidence), units/periods/source/status, limitations, `generatedAt`, partial/insufficient status and optional station IDs for UI highlighting. Prefer rendering numeric facts directly from validated tool data; never trust free-form generated numbers without evidence mapping.
7. **Citation validation:** reject unknown citation IDs, mismatched station/time/metric, or narrative numeric claims that cannot be supported by structured evidence as far as mechanically feasible. If answer cannot be grounded, respond with uncertainty/insufficient evidence instead of 'guessing'. Do not assert hallucination prevention is perfect.
8. **API security/cost:** server-only `OPENAI_API_KEY`, model/config centralized, bounded number of tool calls and iterations, request timeout, max input/output tokens, per-session or IP abuse control when appropriate, logs scrubbed, separate usage/cost estimates if measurable. Agent cannot perform writes, browse arbitrary URLs or follow instructions inside tool results. No model API requests during CI.
9. **UI:** small optional Analysis contextual panel, displays question, grounded answer, citations and limitations, visibly cites data mode (sample/historical/live) and preliminary status. No AI answer should replace existing deterministic charts or methods. Integrate into existing 4-page navigation only.
10. **Docs:** agent tool architecture, safety model, scoped example questions, evidence proof strategy, source limitations, model/cost controls, setup, offline tests and live gated smoke tests.

## 5. Technical Requirements
- Every tool response is untrusted content; no unauthorized write tool or dynamic code execution.
- No phantom station IDs, percentages, AQI, times, sample counts, or provider URLs.
- Work with only existing data and current service capabilities; a small valid subset is better than broad claims.
- Default (no key) leaves all V1 functionality fully operational. API usage page must not miscount OpenAI calls: if instrumented, distinguish LLM outbound from AirNow/AQS.
- Keep V1 local-first and existing PostgreSQL, no Redis/vector DB or cloud app needed.

## 6. Implementation Instructions
Audit completed service capabilities and list supported research intents; select supported LangChain APIs; design narrow Zod tools and deterministic services; implement Express agent endpoint + strict response validation; add compact UI panel with disabled mode and validated citations; install mock model/test harness; update security/methodology docs. Avoid scope creep into document retrieval (Prompt 12).

## 7. Testing and Verification
Use deterministic mock LLM/tool responses; test correct tool selection/args, bounds, unsupported questions, missing/stale values, incompatible units, numerical calculations, no data or invalid citations, tool exceptions, provider unavailable, tool-call loop caps, prompt injection inside tool output, model token limits, API key secrecy, response schema and contextual UI. CI network-free, no paid calls. Optional live tests explicitly gated by `ALLOW_LIVE_LLM_TESTS=true`, log only sanitized results and actual measured token usage. Run all existing V1 tests plus agent-specific tests.

## 8. Acceptance Criteria
- A01: narrow set of meaningful read-only queries work end-to-end using existing services and deterministic calculations.
- A02: every supported numeric answer is attached to **resolvable source evidence**; unsupported data yields insufficient-evidence response.
- A03: no model or provider secret reaches browser, logs or fixture; tool/time/token limits enforced.
- A04: four-page V1 remains unchanged without an OpenAI key; no fifth mandatory page.
- A05: deterministic offline agent tests and all existing CI gates pass; optional live integration evidence clearly labeled.

## 9. Out of Scope
No EPA/CARB document RAG, embeddings/vector search, agent long-term memory, free-form arbitrary browsing, SQL/code execution, autonomous loops, write tools, weather forecasting, regulatory decision making, Python AI service or cloud deployment. Prompt 12 is the separate RAG/evaluation milestone.

## 10. Final Report
Summarize actual tool inventory, SDK and model versions, evidence and citation validation strategy, security/cost ceilings, files changed, tests executed/results, optional live verification, limitations, acceptance status and Prompt 12 prerequisites. No fictional citations or false claims of perfect hallucination prevention. **No commit/push.**
