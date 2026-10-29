# V1 architecture — one-page overview

The browser presents four workspaces over a shared validated model. Startup and synthetic/historical browsing require no authenticated air-quality provider call.

```text
React + TypeScript (127.0.0.1:5173)
  ├─ /map · /analysis · /wildfire · /data
  ├─ ArcGIS component → online basemaps (public restricted token)
  └─ /api proxy → Express (127.0.0.1:3001)
                   ├─ Zod query + response boundaries
                   ├─ deterministic synthetic fixtures
                   ├─ checksummed EPA / CAL FIRE / OSFM artifacts
                   ├─ bounded TTL cache + in-flight deduplication
                   ├─ PostgreSQL snapshots (127.0.0.1:55436)
                   └─ provider HTTP boundary → AirNow / AQS
                        guarded until reviewed codecs exist
```

| Decision                              | Reason and consequence                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Shared built ESM Zod contracts        | API/UI enforce identities, bounds, modes, units and timestamps. Internal types do not verify an external provider's wire format.          |
| One ArcGIS view per map page          | Filters/selection update existing graphics; navigation releases the view. Analysis owns the only full chart.                              |
| Explicit sample/historical/live       | No implicit fallback. History is replayed with provenance, never refreshed or relabeled as Live.                                          |
| Source-native monitor identity        | Provider + site + parameter + POC distinguish co-located monitors. Areas and forecasts use separate contracts.                            |
| Sparse rows plus hourly slots         | Null, absent, conflicting and outside-coverage slots remain gaps; zero and negative measurements remain values.                           |
| Immutable content-addressed snapshots | Bounded replay and idempotent seeds. Migrations use ownership markers, checksums, transactions and advisory locks; no automatic deletion. |
| Instrument actual outbound sends      | Retries count individually; attempts = success + failure + in-flight. Local cache modes and browser ArcGIS traffic remain separate.       |
| Preview hash → CSV/JSON export        | Export matches the inspected selection. Manifests retain lineage; CSV adds spreadsheet protection and lossless JSON records.              |

Engineering bounds: 72-hour windows; three plotted monitors; 32 snapshots / 512 identities / 2,000 records per snapshot; 500-row / 3 MB exports; four concurrent preview/export operations; bounded cache entries/bytes/pending loads. These are application limits, not provider quotas.

The API binds to loopback and uses restricted project database roles. Only the exact deliberately public ArcGIS token reaches the browser. No auth service, public deployment, LLM, Python service, warehouse or ingestion scheduler belongs to V1. See [limitations](known-issues.md) and [release evidence](../milestones/10-v1-freeze-review.md).
