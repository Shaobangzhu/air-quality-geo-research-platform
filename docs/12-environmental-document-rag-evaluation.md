# Prompt 12 — Environmental Document RAG + Agent Evaluation

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** **Future AI Research Extension** (requires Prompt 11)  
**Recommended Codex effort:** High / Extra High if available and justified

## 1. Role and Execution Mode
Act as the senior retrieval engineer, LLM evaluation lead and environmental science methods reviewer. **Do not start until the user explicitly selects Prompt 12 and Prompt 11 is accepted.** Inspect current code, citations, document versions, database and installed SDKs before changing anything. Implement and run tests; do not merely design a pipeline. Preserve V1 and user changes; no automatic commit/push.

## 2. Repository Context
Greater LA Air Quality Geo Research Platform is local-first with four V1 pages, an existing local Docker PostgreSQL data store, Express orchestration and a verified Prompt 11 read-only Agent. This milestone extends the existing Agent with **authoritative environmental methodology document retrieval**, not vectorization of structured AirNow observations. It must not change the core v1 freeze. Only a compact optional contextual Research Assistant panel remains; no new mandatory AI navigation page.

## 3. Objective
Integrate reproducible, provenance-preserving **EPA / AirNow / CARB document RAG** with the already implemented deterministic environmental-data tools and a credible evaluation suite for retrieval relevance, citations, grounded claims, scientific limitations and prompt-injection resistance.

## 4. Scope
1. **Curated corpus:** choose a **small verified corpus** of publicly accessible and appropriately reusable EPA AQI/NowCast, AirNow preliminary-data/methodology, EPA AQS/AirData, CARB air-quality monitoring or wildfire methodology docs. Validate original URL and copyright/reuse terms; do not fabricate titles/versions/publication dates. Avoid committing massive copyrighted PDFs or raw crawls. Store metadata and, where permitted, bounded derived excerpts.
2. **Local-first acquisition pipeline:** explicit authorized document fetch or manual import command; validate allowed hosts/types/content size, no arbitrary remote URL import via agent/user query, no SSRF or secret-bearing paths; extract text, chunk with overlap where justified, preserve metadata per chunk (source organization, document ID/title/version, canonical URL, retrieved/indexed date, section/page, chunk ID, checksum). Stable IDs must not shift needlessly on re-index. Show limitations when publisher provides only HTML or document content has parsing loss.
3. **Embeddings and vector retrieval:** inspect local PostgreSQL for `pgvector`. If available and permitted, use **the existing isolated database** for stored embeddings/indexes. If not, choose a small reproducible local file/database-backed cosine retrieval approach without installing or reconfiguring PostgreSQL extensions beyond the user's permissions. Do not add MongoDB, Pinecone, hosted vector stores, new Docker containers or Kubernetes just for a small PoC. Store embedding provider/model/dimension/index version and re-embed only on document change. Production embedding generation optional with `OPENAI_API_KEY`; offline CI uses fixed small vectors/test doubles.
4. **Separate evidence types:** `dataCitation` resolves to actual structured observation/aggregate tool output; `documentCitation` resolves to actual retrieved document chunk with section/page/URL. Keep these typed, distinguish in UI and response schema, validate against tool/retrieval manifests, and never cite a methodology doc as evidence of a particular observed PM2.5 value. Report missing/contradictory/outdated source evidence accurately.
5. **Combined tool workflow:** route numeric questions to deterministic services, concept/method questions to document retrieval, combined questions to both. Example: 'Compare selected regions' (only where existing deterministic services truly support that comparison) 'and explain whether AirNow preliminary results can support regulatory compliance conclusions' -> numeric tool result plus independent EPA document explanation. Never substitute semantic search of embedded observations for calculation of numeric statistics. If region comparison service was not implemented, don't fabricate it.
6. **Answer grounding:** structured response includes answer, data citations, document citations, observed timestamps, source versions, limitations, and insufficient-evidence state. Implement deterministic citation-ID existence and key field checks; define feasible claim-grounding checks and curated evaluation examples. Do not promise perfect hallucination detection.
7. **Agent/UI integration:** extend existing compact Analysis or Wildfire research context panel to show citations differentiated by type, source section, retrieved date and limitations; allow users to open source references. Keep `/data` source catalog aligned with corpus metadata when relevant, but do not add a fifth page or duplicate a complete document library UI.
8. **Evaluation suite:** versioned fixed fixture set with questions, expected tools/retrieval chunks, known numeric evidence, required limitations and unsupported cases. Deterministic assertions for tool choice, valid IDs, units/timestamps, numeric accuracy, retrieval top-k against fixed corpus, injection attempts embedded within docs, source conflicts, unavailable sources, refusal to invent values, stale evidence, and leakage. Optional evaluator-model run behind explicit paid/gated setting, not normal CI. Report metrics with denominators and test-set size; don't present '100% reliable' based on a small suite.
9. **Security/cost:** server-side model and embeddings keys, network and corpus allowlists, prompt injection defense treats retrieved text as untrusted data, bounded source length/embedding and tool tokens, index/prompt versioning, per-request timeouts, cost usage via existing API usage patterns when measurable; no arbitrary uploads or autonomous web browsing.
10. **Docs:** curated corpus manifest, source licensing, preprocessing/chunking, index version, retrieval and citation contracts, scientific limitations, evaluation methodology/coverage and reproducibility commands.

## 5. Technical Requirements
- No false equivalence between AirNow preliminary current data and validated AQS historical data; document retrieval never upgrades the validity of measurements.
- No fabricated regulatory interpretations; distinguish AQI, concentrations, averaging, observation vs forecast, FHSZ hazard vs risk and official vs derived smoke surfaces.
- No raw secret text, private URLs or arbitrary files passed to retrieval; sources are curated/verified.
- No change to existing React/ArcGIS scientific data services or source calculations except minimal integration fixes.
- CI offline and no paid OpenAI embeddings/LLM requests; local data/index artifacts are reproducible and bounded.

## 6. Implementation Instructions
Audit Prompt 11 evidence and agent service; select and verify small public corpus; create source manifest and safe ingestion command; implement metadata-preserving chunking and local retrieval/index; extend agent tool with typed document citations; add claims/citation integrity checks; build deterministic evaluation harness; integrate optional context UI and docs. Verify real model API patterns against official current docs rather than relying on legacy imports. No new infrastructure unless clearly justified.

## 7. Testing and Verification
Document ingestion/format validation, stable IDs, chunk/page metadata, source attribution, deterministic retrieval ranking, no paid CI calls, stale version update, contradictory sources, missing doc, unknown citations, unreferenced numerical claims, tool/data/doc separation, malicious prompt instruction in source text, secret and URL blocking, bounded token/size, reproducible evaluation run and one combined question. Re-run all existing V1 and Prompt 11 tests; verify DB migration and rollback safety in isolated CI DB. Report real evaluation sample size and results, not claims of blanket reliability.

## 8. Acceptance Criteria
- A01: a small authoritative verified corpus is indexed locally with source/version/section provenance.
- A02: document retrieval works and all cited chunk IDs resolve to actual retrieved source material.
- A03: agent combines document explanations with existing deterministic numeric tool results, with separate citation types and honest limitations.
- A04: reproducible offline evaluation covers retrieval, numerical/citation integrity, failure and prompt-injection cases with transparent metrics.
- A05: no key leak, hosted vector-store requirement or V1 regression; optional live calls gated and cost-bounded.

## 9. Out of Scope
No general internet research agent, arbitrary PDFs uploaded by untrusted users, automatic scientific literature review, large vector service or multi-tenant document system, new Python AI microservice, traffic/wildfire source-apportionment model, autonomous actions, regulatory advice or cloud architecture.

## 10. Final Report
Include corpus inventory and reuse proof, chunk/index schema, retrieval/citation examples tied to real test evidence, evaluation cases/results with denominators, injected-document test outcomes, actual vs optional model calls, security/cost limits, test commands and results, acceptance status, limitations and future research opportunities. **Do not commit/push.**
