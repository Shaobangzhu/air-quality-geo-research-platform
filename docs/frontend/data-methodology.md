# Data & Methodology — Prompt 09

`/data` is the single transparency workspace. Four internal ARIA tabs (`sources`, `preview`, `methods`, `usage`) share one visible panel. The `tab` query parameter supports refresh/Back and keyboard Left/Right/Home/End navigation. The page has no map, station drawer, chart or decorative sparklines. Its header says “Data transparency”; individual sources/selections carry their actual mode and availability.

## Sources and status

`GET /api/data/catalog` combines existing BFF snapshot metadata, the bundled synthetic fixtures, the checksummed Eaton manifest and the actual browser-basemap integration. Catalog generation uses existing sample caches and at most two bounded historical metadata queries (32 stored snapshots maximum). Local sample cache decisions count as such; this read never invokes a live provider. A missing database does not hide the working file-backed official case. A blocked case remains separate from other sources.

Rows distinguish local file/database, contract-unverified and browser-managed connection states from scientific status. AirNow production access remains unavailable; a key is not a successful connection. EPA AirData historical row certification remains unknown unless supplied with evidence. CAL FIRE display geometry is a documented derivative, with original versions/dates/limitations. ArcGIS is a client basemap and relief service; no separate elevation dataset or 3D service is claimed integrated. CARB/OpenAI are not listed as active feeds.

Source detail is one compact area. Unknown release/version/acquisition/indexing fields remain unknown, never server-start dates. The catalog preserves the difference between incident, study window, perimeter release, SRA effective date and later LRA recommendations.

## Preview and export

`GET /api/data/preview` accepts an explicit local dataset: `sample-stations`, `sample-area-aqi`, `sample-forecasts`, `eaton-observations`, or `snapshot` with its historical UUID. There is no implicit sample fallback for a historical/live context. No live export dataset is offered while production codecs remain unverified.

Selectors cover the engineering region, canonical pollutant, measurement kind, distinct station/monitor or reporting area, and supported source time bounds. Observation filters use whole-hour UTC instants (`from` inclusive, `to` exclusive), at most 72 hours and within source coverage. Blank bounds use the source window, including the complete stored historical snapshot rather than its default map window. Forecast validity filters use literal dates (`validFromDate` inclusive, `validToDate` exclusive). Unknown observation times in area samples are not forced into an hourly filter. Unknown issuance and date-only validity stay unchanged.

Preview is explicit (Load preview), at most 10 rows per page. Exports cover all selected rows, capped at 500 rows and 3 MB; a larger selection is rejected and must be narrowed. At most four preview/export operations run concurrently. No arbitrary file path, SQL, URL or output name is accepted. The API reuses existing normalization, bounded snapshot reads and separate area service; the first 20 area rows are not silently treated as the complete dataset.

Changing a selector invalidates the current preview/export controls. Each preview returns a SHA-256 selection hash over canonical query, selected records and source context. Download endpoints require that hash, reject pagination and re-resolve the same immutable local source. A changed selection is a conflict rather than a different file under the old preview. Native original identities, co-located monitors, values/nulls/zeroes/negatives, periods, qualifiers and revisions are preserved. Absence of an observation creates no artificial row.

JSON and CSV downloads include provenance; see [export encoding/schema](../architecture/data-exports.md). Observation/area/forecast records are exportable. Raw GIS/basemap redistribution is not offered as an observation export; their source manifests and official references are available in Sources and the case page.

## Methods and usage

The seven methods accordions link primary documentation and describe implemented semantics: AQI/concentration; source certification; station/reporting area; prediction/observation; UTC/LST/DST; FHSZ hazard; missing data/causal limits. The content follows [scientific semantics](../research/data-semantics.md), not styling mockup values.

Usage reads the existing `GET /api/usage/summary` on opening its tab and on explicit refresh. No background polling or external request is created by visiting tabs. The four cards and provider table derive directly from the validated response. Counts may legitimately be zero. The UI shows `startedAt`, summary `lastUpdatedAt`, process resets, in-flight attempts, cache lookups and the ArcGIS client exclusion. See [counter definitions](../architecture/api-usage.md). These metrics are not provider billing/credit measurements.
