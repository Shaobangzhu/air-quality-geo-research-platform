# Prompt 12 — local methodology retrieval

This extension adds a small reviewed methodology corpus to the existing Analysis assistant. It preserves the four-page V1 and the deterministic station services. Method-only questions retrieve documents without reading observations; the combined preset reads selected observations and independently retrieves the preliminary-data explanation. No document is used as evidence of a measured pollutant value.

## Verified corpus and reuse

The corpus is `fixtures/methodology/corpus.json`: **three official source pages, five section-level original factual paraphrases**, reviewed October 29, 2026 PDT (October 30 UTC). These are explicitly labeled `reviewed-paraphrase`, not verbatim publisher excerpts, full documents or externally authored official answers.

| Source                                                                                          | Sections indexed                      | Version/publication     | Reuse basis and limit                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AirNow About the Data](https://www.airnow.gov/about-the-data/)                                 | Validation/purpose; reporting latency | Not supplied            | Original bounded factual summaries, with attribution; no source paragraphs, tables or images redistributed. No blanket publisher-license or public-domain claim.                                                                                                                    |
| [EPA AirData Download Files Documentation](https://aqs.epa.gov/aqsweb/airdata/FileFormats.html) | 1.1 Monitors; 1.2 Pollutant Standards | 3.0.0, December 1, 2015 | Original factual summaries. [EPA copyright notice](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers) discusses noncommercial scientific/educational use subject to individual-document conditions; it is not treated as universal permission for all linked content. |
| [AirNow AQI Basics](https://www.airnow.gov/aqi/aqi-basics/)                                     | AQI definition/communication purpose  | Not supplied            | Original factual summary; no copied AQI table or graphics, thresholds, treatment advice or clinical recommendations.                                                                                                                                                                |

The official pages were opened and checked against the summaries, then fetched by the bounded acquisition command. [Acquisition metadata](../research/methodology-acquisition.json) records canonical URLs, retrieval times, received-byte checksums and extraction limitations. Raw HTML is not committed. The local tag-stripped review files may contain navigation/entities and are not automatically promoted to the corpus. No legal conclusion about all government-site reuse is made; copying larger passages or redistributing PDFs requires a separate rights review.

[CARB AQMIS](https://www.arb.ca.gov/aqmis2/aqmis2.php) was verified as describing both preliminary and official data, but its linked Conditions of Use returned an anti-bot page. CARB text is therefore **excluded**, not represented as licensed/indexed. NowCast formulas, wildfire methodology and regulatory interpretation beyond the stated preliminary-data distinction are also outside this small corpus.

## Acquisition and reproducible indexing

```sh
npm run corpus:fetch  # explicit public network acquisition; fixed URLs only
npm run corpus:build # reviewed local manifest -> deterministic index
npm run corpus:check # refuses any content/index drift
npm run retrieval:eval
```

`corpus:fetch` accepts no URL/path/upload arguments. The three exact HTTPS URLs are allowlisted; query strings, credentials, redirects and other hosts are refused. Each response must be successful HTML, at most 500 KB streamed, with a ten-second timeout. It removes script/style bodies and HTML tags for bounded ignored review copies, retaining at most 60,000 extracted characters. This is a review aid with known parsing loss, not an HTML-to-document fidelity claim.

Manual import means editing only the fixed reviewed manifest after source/rights review. Unknown fields, unapproved URLs, excessive lengths, duplicate/conflicting topics and obvious secret/instruction strings are rejected. Each section is already a short coherent chunk; no overlap or sentence slicing is needed. Section names are retained; page is null for HTML. Document version/publication remain null where the publisher supplies neither. Retrieved dates record the source review; indexed dates separately record the reviewed index revision. Both are explicit manifest metadata retained on identical rebuilds, not invented publication dates.

Chunk IDs hash document ID, publisher version, section and text checksum. Reordering sources or rebuilding changes no IDs; changing one section changes only that section's ID/vector. Rebuilding identical content does not rewrite the index. The checked-in index includes the normalized corpus hash, vector model/version/provider/dimension and all chunk metadata. Runtime recomputes and checks the index against the manifest, refusing drift. No automatic refresh/re-embedding is performed.

## Retrieval choice and database evidence

Read-only metadata inspection of the explicitly confirmed `air_quality_geo_research` database found pgvector **neither installed nor available**. No extension, schema, migration, role, container or volume was changed. Local file-backed cosine retrieval is used instead.

`local-hash-tf-512-v1` is a deterministic **lexical feature-vector model**, not a neural embedding or an OpenAI embedding substitute. Lowercase word tokens excluding a fixed stop list map by SHA-256 into 512 term-frequency bins and are L2-normalized. Cosine scores use a fixed 0.1 minimum, deterministic ID tie-breaking and top-k at most three. Hash collisions and poor synonym/multilingual recall are known limits. Recomputing this tiny index is cheap; unchanged sections retain identical vectors. No pretrained semantic representation is claimed.

The actual corpus has five topic chunks; fixed supported questions use bounded retrieval queries and require the expected topic in the returned top three. Missing, conflicting, over-180-day-old reviews or manifest-mismatched citations produce insufficient evidence. An old publication date is displayed honestly and is different from an expired review. Scores do not establish truth or resolve contradictory scientific guidance.

## Agent, citations and UI

The existing LangChain/OpenAI wrapper adds `retrieve_methodology` alongside `get_selected_station_series`. Exactly one model-routing call and one named tool choice remain; the combined tool performs two bounded deterministic local reads. Shared intent validation rejects the wrong tool, unsupported intent or invented arguments. Method presets cover preliminary-data validity, AQS monitor identity and AQI vs concentration. Region comparison, free-form research, NowCast calculation and regulatory advice are unsupported.

Data citations remain `type: data`, resolving to the exact returned station series and source observation IDs. Document citations are `type: document`, resolving to a returned chunk with canonical URL, organization, section, version/publication uncertainty, review/index timestamps and text checksum. Server validation compares every returned document chunk to the reviewed index. A document cannot replace observation evidence or upgrade sample/preliminary/unknown measurement status.

The model never receives retrieved text or observations and never gets a continuation turn. Explanations are the reviewed retrieved paraphrases, not unrestricted generated prose. This is intentionally retrieval-augmented structured answering with deterministic explanation rendering, not a generic generative chatbot. It limits prompt-injection impact; heuristic text checks alone are not claimed to detect every malicious instruction. Local files remain a reviewed trust boundary.

The optional Analysis panel labels document evidence separately and links original sections/pages. `/data` has a collapsed methodology-source listing backed by the same local index; it is explicitly separate from observation providers. No new page or duplicate document library is added.

## Cost, security and verification

No paid embedding generation or evaluator-model execution is implemented or required. CI is offline; corpus acquisition is an explicit separate command. Existing Prompt 11 feature/key gating, fixed OpenAI endpoint, disabled tracing, one model call, zero retries, output/input envelope checks, timeout, concurrency and process request limits remain. Document content is rendered as React text, never executed. No arbitrary browsing, files, SQL or write tools are exposed to the agent. AirNow/AQS counters do not include document reads or LLM costs.

Official [OpenAI function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling) was rechecked; installed SDK APIs remain unchanged. The previously tested model snapshot is deprecated, and no migration or additional paid call was performed for Prompt 12. Existing `research:smoke` remains opt-in and tests the original numeric preset; it is not evidence of live combined-RAG validation.

The versioned retrieval fixture has 12 fixed lexical queries across all five topics. [Measured results](../research/retrieval-evaluation.json) report **12/12 Top-1 and 12/12 Hit@3**. This tiny hand-curated set has no independent held-out generalization claim. Tests separately cover stable IDs, updates, missing/stale/conflicting sources, malformed/unknown citations, checksum tampering, instruction/secret/URL rejection, acquisition limits and combined numeric/document separation. Existing numerical alignment, negative/null values and scientific status tests remain authoritative for data calculations.

See the [milestone report](../milestones/12-methodology-retrieval.md) for exact executed gates and remaining limits. Future work could add reviewed source diversity, held-out queries, licensed raw-section extraction and separately gated semantic embeddings; none is silently represented as implemented here.
