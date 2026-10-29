# Engineering interview stories

These are evidence prompts, not invented team accomplishments. Adapt first-person wording to work you personally performed; do not claim production customers, savings or measurements absent from this repository.

## Provider normalization without false certainty

**Situation:** Mockups showed active sources, air-quality values and forecasts, but those labels were not evidence. AirNow's 2026 migration replaced six services; sites, reporting areas and forecasts have distinct meanings.

**Task:** Deliver a repeatable demo with a credible provider boundary, preventing synthetic data from appearing live or validated.

**Action:** Inspect official migration documentation; guard the unreviewed production codec; define separate Zod contracts. Preserve site/parameter/POC, units/periods, nulls, negative values, date-only validity, unknown issuance and provenance. Use clearly labeled synthetic fixtures and separately sourced Eaton artifacts.

**Result:** A keyless four-page workflow runs deterministically while unavailable products remain explicit. Tests verify zero external provider attempts for local paths and no silent mode fallback. Exports retain native records and manifests. Evidence: [provider review](../data-sources/provider-capabilities.md), [normalization tests](../../tests/unit/bff-normalize.test.ts), [area tests](../../tests/unit/area-products.test.ts), [export tests](../../tests/unit/data-workbench.test.ts).

**Tradeoff:** “I deferred live integration until the wire contract could be reviewed. Samples demonstrate interactions; they cannot prove provider availability or scientific validity.”

## Quality gates for a repeatable local release

**Situation:** A successful page load does not prove database safety, missing-data correctness or reproducibility. Docker hosted unrelated projects, and local results could differ from CI.

**Task:** Make the interview PoC auditable without resets or unverified CI claims.

**Action:** Use dedicated loopback PostgreSQL with separate restricted development/test roles, checksummed additive migrations and idempotent seeds. Combine unit/contract/Supertest/React tests with real PostgreSQL and isolated-port Chromium. Add loading/failure/recovery coverage, actual screenshots and exact public-token exposure. Inspect remote Actions for a specific commit.

**Result:** Repeated migrations/seeds preserve snapshot identities. Tests cover null gaps, DST, comparison compatibility, export escaping/limits and actual-send metrics. The [release review](../milestones/10-v1-freeze-review.md) records exact outcomes and distinguishes the successful remote baseline from uncommitted local changes.

**Tradeoff:** “I kept one map view, one chart and bounded snapshots. Targeted passing checks support those paths; they are not perfect-security or full WCAG certification claims.”
