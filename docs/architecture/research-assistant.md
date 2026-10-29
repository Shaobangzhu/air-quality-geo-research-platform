# Prompt 11 — bounded read-only Research Assistant

This optional extension is separate from the frozen Core V1. Expand **Research Assistant** below Analysis to check its configuration. No fifth route, database migration, container or provider codec is added. A collapsed panel performs no requests; no key or disabled configuration leaves charts and existing workflows operational.

## Supported questions and architecture

The three exact preset questions are: summarize selected observations; inspect missingness/cache freshness; compare selected station ranges/coverage. They use the current 1–3 station identities, engineering region, pollutant, metric and pinned 24/48/72-hour window. Historical requests require an existing snapshot UUID. Only sample and stored historical analysis are enabled. Live, forecasts, 12-hour windows, arbitrary questions, regional rankings/means, conversions and causality are unsupported.

Express `POST /api/research/answer` → `ResearchAssistant` → LangChain `ChatOpenAI.bindTools` → one validated `get_selected_station_series` call → existing `BffService.analysis` → existing sample/cache or historical snapshot reader. The only model-controlled argument is the enum `intent`; the validated request context is bound by the server. The tool cannot supply a different station, bbox, time window, URL or SQL expression. The model receives a fixed question and tool definition, not observations, provider text or credentials from domain services.

The flow is deliberately one step: one model invocation, at most one tool execution, no model continuation after the tool returns. A model call with a wrong intent, unknown tool, extra argument, multiple calls or malformed arguments fails closed. No LangGraph/state store is needed. This evaluates the current agent APIs without introducing an autonomous loop or a generic chatbot.

## Evidence and scientific interpretation

Numeric processing reuses the existing tested `buildAnalysis` / `summarizeSeries` services. No model arithmetic, conversion, average, regional AQI or free-form narrative is displayed. The short answer comes from a fixed enum; the UI renders ranges/counts directly from validated evidence. Every citation is a selected station's stable opaque ID resolving to its returned series, which includes observation IDs, UTC slots, original measurements, units, periods, provenance/status and source references. Users can expand the cited records. A station citation identifies this response's scoped series; it is not a globally immutable snapshot identifier by itself.

The shared strict response schema revalidates existing analysis semantics and citation membership. Server checks bind region/mode/metric/time/snapshot/station identities to the request; the UI rejects mismatched context. Missingness and conflicts yield partial status; incompatible units/averaging or no usable observations yield insufficient evidence. No invented station or numeric claim can enter through model prose because that prose is discarded. This constrained design is not a claim of perfect hallucination prevention or source-data correctness.

Sample is synthetic. Preliminary and unknown source statuses remain in records; historical AQS provenance does not imply certification. Freshness is supplied observation/cache metadata, not an assessment of current conditions. Source text is rendered as escaped React text, never interpreted as instructions or HTML. Raw source results are never fed back to the model.

## SDK and model selection

Verified official documentation on October 29, 2026:

- [LangChain JavaScript agents](https://docs.langchain.com/oss/javascript/langchain/agents) — evaluated; a bounded tool-routing step is sufficient here.
- [LangChain ChatOpenAI](https://docs.langchain.com/oss/javascript/integrations/chat/openai) and [tools](https://docs.langchain.com/oss/javascript/langchain/tools) — supported `bindTools`, `tool`, strict Zod inputs and abort signal.
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) and [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) — supported tool calling with a pinned snapshot.

Installed exact direct versions: `@langchain/core` **1.3.1**, `@langchain/openai` **1.8.0**. Lockfile resolves transitive OpenAI SDK **7.45.1**. Central model constant: **gpt-4.1-mini-2025-04-14**. This is a bounded tool-routing choice, not a claim that it is the newest model. Account access and paid runtime behavior remain unverified unless the gated smoke is explicitly run.

## Safety, cost and operation

- Server-only `OPENAI_API_KEY`; exact public ArcGIS exposure remains unchanged. No tools for writes, shell, code, files, arbitrary fetch, RAG or direct air-quality provider access.
- Default `RESEARCH_ASSISTANT_ENABLED=false`. Set it to `true` with a key in the ignored root `.env`, then restart the API. The question button initiates a paid model request when enabled; opening the panel only checks status.
- One call/request, zero SDK retries, 512 output-token ceiling, 12-second SDK timeout, 15-second request deadline. Static prompt/question/tool-schema serialization is capped at 3,072 UTF-8 bytes, leaving conservative framing reserve under the 4,096 input-token budget; reported usage above budget is rejected. This is an application bound, not an account spending limit.
- Global process ceiling: six admitted requests/minute and two active executions. Timed-out uncooperative work retains its concurrency slot until settled. This is suitable for the loopback PoC, not multi-tenant distributed abuse protection.
- Strict 4 KB request body, at most three stations/72 hours/500 returned records/1 MB response. Existing data services retain their bounds and database statement timeouts. Local sample/historical readers make no external air-quality calls.
- JSON/custom-header requests only; cross-origin browser origins outside local dev/test URLs rejected. No CORS enablement. The API remains loopback-only.
- OpenAI endpoint fixed to `https://api.openai.com/v1`; SDK logging off, verbose false. Ambient LangChain/LangSmith tracing is refused. Exceptions are replaced by fixed messages; configured secret values are checked against serialized evidence. No prompt, provider response, key or connection string is logged.
- AirNow/AQS usage counters exclude OpenAI, explicitly labeled in `/data`. No dollar estimate or combined billing total is advertised. The opt-in smoke reports only actual returned input/output token counts, status and evidence count; missing usage stays unknown.

## Tests and optional live smoke

Default unit/API/React and Chromium tests use mock model responses; no CI model requests. Coverage includes tool/argument/intent bounds, unknown citations, context/metric mismatch, altered numeric evidence, negatives/gaps, stale/empty/incompatible evidence, exceptions, prompt-injection text, timeout/concurrency/rate limits, input/output token budgets, SDK configuration, tracing refusal, disabled UI and grounded rendering. Existing V1 gates continue to run.

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm run test:db:local
npm run test:e2e
```

Optional paid smoke, only after deliberately opting in locally:

```sh
ALLOW_LIVE_LLM_TESTS=true npm run research:smoke
```

It requires a server key, uses synthetic sample evidence through the same orchestration, never creates database infrastructure and emits only sanitized status/counts/measured usage. `ALLOW_LIVE_LLM_TESTS` does not enable UI requests; the separate feature flag controls those. No paid smoke was run during implementation.

Prompt 12 remains separate: no embeddings, document retrieval, vector database, memory or attribution engine has been added. Any future RAG work needs independently approved corpus provenance, retrieval/citation contracts and evaluation; it is not needed for these three questions.
