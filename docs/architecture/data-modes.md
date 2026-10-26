# Explicit data modes and local imports

Mode and availability are separate. `DATA_MODE` chooses the default; a validated query `mode` explicitly overrides it. `unavailable` is never a mode or an invented result. No error path silently changes mode.

| Mode       | Source                                                                                        | Current behavior                                                                 |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| sample     | `fixtures/synthetic/bff-hourly.json`                                                          | Working deterministic synthetic path, no HTTP or DB required                     |
| historical | An identified local `data_snapshots` UUID with mode historical and origin official-historical | Read path implemented/tested; no official historical dataset is bundled/acquired |
| live       | An eligible server provider adapter                                                           | AirNow is explicitly contract-unverified; no production wire codec is registered |

The sample fixture contains fictional SAMPLE- native IDs, co-located 00A/00B monitors, pollutant identities, raw negatives, zeroes, nulls and an omitted timestamp. Its numbers/agency/coordinates are invented. Its fixed end is `2026-01-15T21:00:00Z`; acquisition and observation time are distinct. The fixture is an **application import format**, not a claimed AirNow payload. The earlier Prompt 01 fixture remains unchanged.

## Snapshot import

`snapshots:import` is a local CLI, not a public HTTP write endpoint. It requires the existing guarded project DATABASE_URL and ownership confirmation. Files are limited to 2 MB; normalized batches to 256 identities, 2,000 observations and 72 hours. Imports are transactional, idempotent by content hash and subject to store capacity; they never prune old records.

```sh
npm run snapshots:import -- --file fixtures/synthetic/bff-hourly.json
```

This command creates a **sample** snapshot and prints its UUID, mode and count without credentials. Querying that UUID with `mode=historical` is rejected. Sample API browsing continues to read the bundled fixture directly, so changing the DB cannot silently change the sample demonstration.

A curated official import uses `format: aq-workbench-import-v1`, `dataMode: historical`, `origin: official-historical`, `importMethod: curated-file`, the matching source ID (`airnow-hourly` or `epa-aqs`), a credential-free official source reference, a descriptive label, acquisition UTC, bbox/window and normalized input rows. The exact manifest/row contracts are `importManifestSchema` and `importRowSchema` in the API normalization module. This is a curation boundary, not an AQS/AirNow wire schema or an automated historical download adapter.

Each row supplies string provider/native/monitor/parameter identity, name/coordinates/source agency, observed UTC, explicit period/averaging/source timezone, separate normalized measurement and raw diagnostics, and data status. Preserve the original source evidence and document any preprocessing before import. No synthetic IDs/origins may be relabeled official. AirNow remains preliminary even when archived; AQS validation status requires evidence, not merely a historical date. The BFF performs no scientific calculation or silent correction.

The import CLI refuses live manifests. Future live capture must originate from a verified adapter; captured live rows do not become an eligible historical dataset automatically. A deliberate curation/import step is required.

## Reading historical data

Discover local metadata through `/api/datasets?mode=historical`; supply its `snapshotId` to station/observation queries. An absent ID, missing snapshot, wrong mode or unsupported interval has a distinct error. Source coverage is preserved in metadata; the requested window cannot exceed the local snapshot window. Historical reads do not call AirNow/AQS even if all server keys exist.

No official historical numeric fixture was created for this milestone. Tests modeling official provenance are explicitly marked test doubles and are never imported into the application as official data. Actual PostgreSQL tests store only labeled synthetic records.

## Live and stale state

The local keys are present, but `ALLOW_LIVE_API_TESTS` remains false. This flag gates explicit smoke verification, not sample/historical browsing. It does not override the unverified-contract guard. The current smoke command reports NOT RUN, and even an opt-in cannot bypass missing contract evidence.

Future explicit live queries require a key and a reviewed server codec for the retained `/aq/data/` route. No legacy route is introduced. Within bounded memory stale grace, provider failure can return the original live result with stale metadata and its original timestamp; it never returns sample numbers labeled live. After process restart there is no unmarked memory fallback, and usage counters restart as well.
