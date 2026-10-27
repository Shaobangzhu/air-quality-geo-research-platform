# Bounded reproducible exports

Endpoints (all read-only):

| Route               | Behavior                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `/api/data/catalog` | Actual integrated source metadata plus bounded local dataset choices; no arbitrary query |
| `/api/data/preview` | Explicit local query, up to 10 preview rows and actual selection count/hash              |
| `/api/exports/json` | Complete selected set (up to 500 records), pinned to preview hash                        |
| `/api/exports/csv`  | Same records/hash, with embedded provenance manifest                                     |

All data/attachment responses use `Cache-Control: no-store`. Attachments have `nosniff`, a fixed safe `aq-<dataset>-<hash prefix>.<format>` filename and UTF-8 content type. Query schemas are strict: duplicate/unknown keys, arbitrary paths/URLs/SQL, incompatible station/area identities, unsupported measurement/date combinations and unbounded ranges are rejected. A three-megabyte byte limit and four-operation concurrency bound apply in addition to the 500-record cap. Export failures do not change source modes.

## JSON `aq-export-v1`

The document is `{ manifest, data }`. Each data item is a strict discriminated record:

- `station-observation`: original normalized `station` and `observation`, including provider/native site/monitor/parameter strings, coordinate, raw value/unit/parameter/qualifier, normalized measurement kind/unit/value, status, timestamps, period and provenance.
- `area-product`: original discriminated reporting-area aggregate or forecast, with area identity, numeric/category/null state, observation or issuance/validity, source category and reporting agency. It is never converted into a station/concentration record.

The manifest includes schema version, dataset, mode, canonical query, exact row count, deterministic selection SHA-256, generation UTC, source acquisition UTC, nullable indexing UTC, provider/reference/label, nullable source version/release, snapshot UUID/checksum, available source coverage, selected units/measurement kinds/averaging/source timezone descriptions, limitations and applicable Eaton source manifests. The query plus source coverage explains a filtered subset. `indexedAt` is null because the existing metadata does not expose a verified indexing timestamp; `fetchedAt` is never reused as an indexing date.

For Eaton, `source.checksum` is the exact selected original EPA-row JSON artifact SHA-256; the nested source manifests identify all corresponding versioned file artifacts. For normalized station batches, the checksum is canonical JSON SHA-256 of the complete normalized batch (the same canonical algorithm as snapshot persistence), not a claim of an original publisher file signature. Selection hashes are deterministic despite changing export generation time. Unknown source version/release remains null for generic imported snapshots. A matching immutable DB snapshot does not imply its provider published a version named after the database UUID.

## CSV encoding

CSV uses UTF-8, comma delimiter, CRLF records and RFC4180 double-quote escaping. There is no BOM. Header columns are fixed in `CSV_COLUMNS` in `apps/api/src/data/workbench.ts`:

`record_type, identity, monitor_id, parameter_id, product, pollutant, measurement_kind, value, unit, observed_at_utc, issued_at_utc, valid_date, valid_from_utc, valid_to_utc, source_time_zone, data_status, raw_qualifier, record_json, manifest_json`

The first record after the header has `record_type=manifest` and the complete JSON manifest in `manifest_json`. Remaining records have `record_type=data`. Thus an empty selection still contains its manifest and zero data records. The selected/exported count excludes the metadata record.

`\N` denotes null in flattened columns; numeric zero remains `0` and a supplied negative number remains numeric. Strings that begin with spreadsheet formula characters (`=`, `+`, `-`, `@`) after whitespace/control characters receive an apostrophe prefix, as do leading tab/CR/LF strings and a literal string `\N`. CSV quoting alone does not prevent spreadsheet formula evaluation. The `record_json` column preserves each complete unmodified original record, so consumers can recover values losslessly without reversing spreadsheet-facing transformations or guessing string-vs-number types. Preserve leading-zero identifiers from the JSON strings rather than relying on a spreadsheet's automatic cell inference.

Generation timestamps and the hash are in the embedded manifest, not an extra sidecar download. JSON and parsed CSV record JSON round-trip to identical data. Date-only forecasts occupy `valid_date`, never an invented UTC field; unknown issuance stays null.

## Lineage and security

The pipeline is source snapshot/fixture → existing strict normalization or area validator → bounded query/filter → selected record hash → preview/export. Historical AQS certification, preliminary AirNow status, qualifiers, revisions and missing observations remain distinct. Source status is not inferred from age, acquisition success or another provider's status. No interpolation, AQI calculation, regulatory report or causal source attribution is introduced.

Server-only AirNow/AQS/OpenAI credentials, AQS email and DB URL are checked against serialized output at the runtime boundary. Official source URLs must be credential-free; exported query fields cannot contain arbitrary URLs/tokens. Secrets are neither exported nor returned in errors. Only the deliberately public browser ArcGIS key is allowed in browser mapping assets; restrict its referrers and privileges.

The workflow reads the existing project DB only; it creates no migration, provider transport, persistent metric store or new infrastructure. Large original archives remain ignored. CAL FIRE attribution/no-warranty and the exact display geometry transformations remain attached to the case source manifests.
