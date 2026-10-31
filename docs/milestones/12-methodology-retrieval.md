# Prompt 12 — document retrieval and evaluation

Completed local verification: October 31, 2026 (America/Los_Angeles). The user accepted Prompt 11 after its separately authorized live smoke and explicitly selected Prompt 12. This report covers the optional extension; the original V1 freeze evidence remains unchanged. No commit or push is performed.

## Acceptance and implemented scope

| Criterion                             | Status                                         | Evidence                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 reviewed local corpus             | PASS within the documented corpus              | Three verified EPA/AirNow pages, five original factual paraphrases, canonical URLs, organization, section, nullable publisher version/date, review/index dates, stable chunk IDs and SHA-256 checksums. CARB is excluded pending reuse verification.                                          |
| A02 retrieval and citation resolution | PASS offline                                   | Actual normalized local lexical vectors, bounded cosine ranking, expected-topic checks and exact chunk-to-manifest validation. Unknown IDs, altered text, wrong topics, stale reviews and missing evidence are refused.                                                                       |
| A03 combined deterministic evidence   | PASS offline                                   | Three method presets and one combined preset extend the existing assistant. Combined answers retain exact deterministic station series and independent document citations; method-only answers do not read observations. Browser coverage uses a mocked model answer and real local evidence. |
| A04 reproducible evaluation           | PASS for the fixed suite                       | Twelve versioned retrieval cases across five topics: 12/12 Top-1 and 12/12 Hit@3. Unit tests cover routing, unchanged numeric evidence, citation integrity and failure/injection cases. This is a small curated set, not a general reliability estimate.                                      |
| A05 bounded optional extension        | PASS locally; live combined routing unverified | Four routes retained, keyless UI works, no new infrastructure or schema changes, no paid embedding/evaluator calls. Existing model limits and configured-secret checks remain. Current changes have no remote CI result.                                                                      |

## Corpus, implementation and examples

The [architecture](../architecture/methodology-retrieval.md) documents the source inventory, reuse basis, acquisition rules, chunk/index schema and scientific limits. The [reviewed manifest](../../fixtures/methodology/corpus.json) contains only original bounded paraphrases, not copied publisher paragraphs or raw crawls. [Acquisition metadata](../research/methodology-acquisition.json) records the three actual source fetches. AirNow publication/version fields remain unknown; EPA AirData identifies version 3.0.0, December 1, 2015. Source age does not imply per-record certification.

Read-only inspection of the confirmed project development database found pgvector neither installed nor available. The implementation therefore uses the checked-in file index and `local-hash-tf-512-v1`: 512-dimensional, normalized lexical term-frequency vectors with deterministic hashing and cosine similarity. These are real local lexical features, not neural embeddings. No extension or container was added. Rebuilds preserve stable IDs/vectors for unchanged sections and refuse unnoticed index drift at runtime.

Concrete evidence from [retrieval evaluation](../research/retrieval-evaluation.json):

- “Does preliminary data establish compliance?” retrieves `doc_487e45148d7653b4f7bed661d400b7f10a7ab3315d7f77764fa6ba0cbc13428b`, the AirNow validation/purpose paraphrase. It explains preliminary status without certifying measurements.
- “What identifies a monitor?” retrieves `doc_2811821add6247595c159e9953772d058bc4381fc74dddf513c97124b0b0c73c`, EPA AirData section 1.1, preserving site/parameter/POC distinctions.
- The combined preset retrieves the first chunk independently of `BffService.analysis`. The unit test compares returned series directly with that service's actual synthetic fixture output, including record provenance, units, timestamps and summaries. Data citations remain `type: data` and resolve to returned station series; document citations are `type: document` and resolve to the reviewed chunk. No observation is embedded or calculated by the model.

The assistant receives only a preset routing question and fixed tool schemas. Retrieved text and observations never enter a model continuation. Reviewed document explanations render as escaped React text. The `/data` source list loads the same corpus on demand inside the existing Sources tab. There is no fifth route or general document-upload interface.

## Evaluation and security evidence

The versioned retrieval fixture has 12 queries; it measures topic retrieval, not natural-language claim truth. Separate tests verify all four new intent routes, exact numeric evidence preservation and no observation read for method-only questions. Forged text and wrong-topic results produce `insufficient` before any numeric read. Unknown citation IDs and noncanonical URLs fail validation. Import rejects a document instructing the system to ignore instructions, execute SQL and reveal an API key. Duplicate conflicting topics, expired review timestamps and unavailable documents fail closed. These checks do not claim universal prompt-injection or contradiction detection.

Acquisition tests refuse loopback/private URLs, credential-bearing URLs and query-string variants before invoking fetch; only three exact canonical HTTPS URLs are accepted. Redirects are disabled, HTML and 500 KB bounds enforced, and scripts/styles stripped from ignored review copies. Extraction is lossy and never automatically promoted to the corpus.

Existing Prompt 11 guards retain one paid model-routing call, zero retries, bounded static input, 512 output tokens, 12-second SDK and 15-second request deadlines, two concurrent operations and six admitted requests/minute. Source/data values stay local. There is no paid embedding or evaluator integration; local document reads do not masquerade as provider API usage or billing metrics. The previously tested model remains pinned and deprecated; migration is separate work.

## Executed checks

Closing verification results are below. Local command logs are in `/private/tmp/aq12-*.log`; the portable retrieval result is retained in the repository.

| Command/check                                   | Result                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                                  | PASS — ESLint and Prettier                                                                                                                                               |
| `npm run typecheck`                             | PASS — contracts built before consumers                                                                                                                                  |
| `npm test`                                      | PASS — 228 tests / 27 files (216 prior tests plus 12 retrieval tests)                                                                                                    |
| `npm run build`                                 | PASS — existing ArcGIS large-chunk warning remains                                                                                                                       |
| `npm run corpus:build` / `npm run corpus:check` | PASS — deterministic index matches the reviewed manifest                                                                                                                 |
| `npm run corpus:fetch`                          | PASS — three allowlisted public sources acquired; no paid API                                                                                                            |
| `npm run retrieval:eval`                        | PASS — 12/12 Top-1; 12/12 Hit@3; actual chunk IDs in the result artifact                                                                                                 |
| `npm run test:db:local`                         | PASS — 6 tests / 3 files against confirmed `air_quality_geo_research_test`                                                                                               |
| `npm run test:e2e`                              | PASS — 22 Chromium tests, including both new retrieval flows                                                                                                             |
| Configured-secret artifact scan                 | PASS — zero hits across 1,121 current browser assets and 201 tracked/nonignored text files; eight configured server-secret fields compared; public ArcGIS token excluded |
| Diff and immutable artifacts                    | PASS — no whitespace errors; migrations, historical fixtures, V1 freeze artifact and lockfile unchanged                                                                  |
| Live Prompt 12 combined model call              | NOT RUN; the earlier authorized Prompt 11 numeric smoke is separate evidence                                                                                             |
| Remote CI                                       | NOT RUN for these changes; CI configuration includes offline corpus and evaluation checks                                                                                |

The first browser run exposed a chart hover event overwriting an explicit observation-inspector selection. A small focus guard now preserves a focused inspector's selection; the existing null-gap test includes a hover regression assertion. The full 22-test rerun passed. No failed test was disabled and no scientific calculation changed.

The closing unit run initially hit the sandbox's loopback-listen restriction; the authorized rerun passed all 228 tests. One production build encountered `ENOTEMPTY` while cleaning old output; rerunning the same build succeeded, and the secret scan used that successful build's asset inventory. These transient execution failures were not treated as passing results.

## Reproduction and limits

Run `npm run corpus:build`, `npm run corpus:check` and `npm run retrieval:eval` without keys or network. Then run the standard lint, typecheck, unit, build and isolated browser suite documented in README. Database integration requires the separately confirmed test database. Only `corpus:fetch` explicitly accesses public source pages; normal CI neither fetches those pages nor calls OpenAI.

CARB content remains outside the index because the linked reuse terms could not be verified. The current corpus also excludes NowCast formulas, broader wildfire methodology and arbitrary regulatory interpretation. Lexical retrieval has hash-collision and synonym/multilingual limitations; five reviewed chunks and twelve curated questions do not establish broad coverage. Future work can add reviewed sources, held-out queries, richer licensed extraction and separately gated semantic embeddings. Free-form generation, region comparison without an existing service and autonomous browsing remain unsupported.
