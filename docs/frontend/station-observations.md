# Station observations — milestone 04

Map Explorer renders only readings actually returned by the local BFF. `sample` means fixed synthetic data, `historical` means a source-labeled stored official snapshot, and `live` requires a verified provider response. The current live AirNow codec remains absent. A prepared key does not change that guard, and no live provider verification happened in this milestone.

## One bounded read for the map

`GET /api/station-readings` uses the existing station query schema: region, pollutant, measurementType, mode, bounded window/bbox, optional historical snapshot and pagination. `stationReadingsResponseSchema` returns `{data: [{station, observations}], meta}`. The existing station and observation endpoints remain compatible. No schema migration or new repository is needed.

The service loads the same bounded cached batch as station discovery/observation reads. It filters source WGS84 coordinates to the requested engineering preset bbox within Greater LA and times to `[from, to)`. It groups by stable station ID and returns the latest supplied timestamp **separately for AQI and concentration**. All revisions/averaging periods tied at that timestamp remain in the response. It never substitutes an older non-null value for a latest null, averages monitors, chooses an arbitrary conflicting revision, converts units or computes AQI. AQI and concentration may have different timestamps or averaging periods; each retains its own fields in the drawer. A counterpart metric is returned only if that source batch actually supplied it. A future provider may support one metric per request; the UI explicitly says when the other is not supplied.

A station with only a counterpart metric remains available with a neutral missing symbol for the requested metric. Stations with no supplied observations in the requested window are absent; an empty list is a valid empty result. This is a view over available source records, not a complete monitoring-network census.

Default pagination is 200 identities; query limit is at most 500, source batches at most 256 identities/2,000 observations. Latest-response observation revisions total at most 2,000. The frontend makes one map-read HTTP request per meaningful region/pollutant/metric/mode/snapshot change, with a 12-second deadline and cancellation/context guards. The BFF retains its bounded cache/coalescing behavior. Map pans, legend/layer changes, drawer selection, passive renders and Analyze navigation do not fetch observations. StrictMode can start and cancel the initial development effect; deterministic tests count requests after initial loading settles.

## Identity, validation and source semantics

Identity remains `(transport provider, nativeSiteId string, monitorId|null, parameterId|null)`, hashed to a shared opaque ID. Leading zeroes/letters and co-located monitors survive. Coordinates and names do not define identity. Exact source observation revisions are deduplicated by the existing normalizer; differing averaging periods and conflicting revisions remain distinct. Source agency, transport provider, mode and validation status remain independent. AirNow records cannot be relabeled validated AQS data.

Existing normalization excludes invalid/out-of-source-coverage coordinates and malformed or out-of-window rows with safe diagnostics. A blank string is not zero; the normalized import representation uses null for missing values, and a malformed blank numeric field is diagnosed/rejected. True zero and permitted negative concentrations survive. The map response schema additionally validates matching IDs, unique monitor identities, WGS84 extent, source/provider/agency/mode, pollutant and requested window. The browser rejects a malformed or mismatched response instead of reflecting raw fields/errors. The catalog reports rejected source-row counts without treating them as a regional coverage estimate.

No reporting-area records or concept-screen values are mapped as monitoring sites. The dashed engineering study bbox is retained, with an explicit non-regulatory-boundary label.

## Symbols, legend and statuses

The page-owned metric selector chooses independent rendering. No concentration-to-AQI calculation is performed.

- **AQI:** supplied nonnegative integer values use [AirNow's six documented categories](https://www.airnow.gov/aqi/aqi-basics/): Good 0–50, Moderate 51–100, Unhealthy for Sensitive Groups 101–150, Unhealthy 151–200, Very Unhealthy 201–300, Hazardous 301+. Standard category fills have dark outlines; numeric/range/category text accompanies the color. A category describes the supplied AQI number, not regulatory validation or a new health/exposure assessment.
- **Concentration:** blue display bins with the actual source unit, explicitly labeled as display bins rather than health thresholds. PM2.5 uses 0–10, >10–25, >25 µg/m³; PM10 uses 0–30, >30–60, >60 µg/m³. Ozone uses 0–0.025, >0.025–0.05, >0.05 ppm or 0–25, >25–50, >50 ppb according to the record unit. Units are not converted or combined. Each present unit has its own legend group. Values below zero use a separate triangle and retain the source number.
- **Neutral diamond:** missing/unsupplied values, stale observations, or multiple latest revisions/periods. Text explains the specific reason. Missing is never zero. Conflicts never receive an arbitrary category. A stale result retains the original value and timestamps in the drawer.
- **Staleness:** either explicit BFF stale-cache metadata, or a live observation more than two hours behind the requested window end. This is an engineering indicator, not a provider SLA. Old fixed sample or historical timestamps are not classified stale merely because wall-clock time is later. Source preliminary/validated/unknown status is shown independently.

One existing ArcGIS map/view now owns the boundary layer plus **one** station GraphicsLayer. Updates reuse station graphics keyed by stable ID where present, remove retired identities and change symbols/selection in place. Loading/errors clear previous-context symbols without replacing the map/layer. Selection uses a larger dark ring. No jitter or merged coordinate is introduced for co-location.

The [current map component](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-map/) emits `arcgisViewClick`; bounded `hitTest` includes only the station layer. Multiple hits produce an explicit monitor chooser. The identity list offers equivalent keyboard selection and works without tiles. A generation token ignores late hit tests after data updates/disposal. All handlers and watchers are removed on unmount. Zoom is positioned bottom-right so the legend does not cover it. Layer toggles are available only when the map has initialized; the metadata/readings list remains usable when it has not.

## Drawer and Analyze handoff

The conditional nonmodal drawer shows synthetic/historical/live provenance, native identity and WGS84 coordinates, a compact AQI/concentration summary, and all latest supplied observation records. Each record retains value/unit, observed/fetched UTC instants, `America/Los_Angeles` time with correct PST/PDT, averaging meaning/description/interval/source time zone, validation status, original source agency, transport provider and qualifier. Null or absent values are labeled missing/not supplied, never invented. Multiple periods/revisions remain visible and have a neutral map symbol. Snapshot ID is shown when supplied by the BFF.

There is one actionable **Analyze This Station** link to `/analysis?…&stationId=<opaque-id>&pollutant=…&mode=…`, also preserving region, selected metric and historical snapshot. Canonical URLs now use `stationId`; legacy milestone-03 `station` links are still parsed. If `stationId` is present it takes precedence and must validate. The analysis page receives validated selection context and honestly says its chart module remains planned. No full time series was added. Escape/Close returns focus to the corresponding list identity.

## Evidence and limits

The fixed sample window is 2026-01-14 21:00Z to 2026-01-15 21:00Z; latest supplied readings are 2026-01-15 20:00Z. Measured through the actual local API/browser: **3 synthetic monitor identities at 2 coordinate locations**, 6 latest records (one AQI and one concentration per identity) for PM2.5. These counts describe this fixture/window, not real LA monitoring coverage. Unit API checks also cover O3 and PM10. No synthetic fixture or stored data was changed.

Real-browser ArcGIS verification exercised actual map point hit testing (two co-located choices), unchanged map/view/layer identities across metric/visibility/selection changes, zero passive map-read requests, disposal on Analyze navigation and zero AirNow/AQS/OpenAI traffic. Historical/live source behavior and stale failures were tested with explicitly modeled provider/repository doubles; no real official historical dataset or live response was acquired. See the [Prompt 04 report](../milestones/04-station-observations.md) for final commands, screenshots and acceptance status, and [AirNow verification constraints](../data-sources/airnow-live-verification.md).

Milestone 05 adds [three engineering presets and linked filter state](map-interactions.md), with parent-batch cache reuse and selection preservation/cleanup. The scientific reading and symbol rules above are retained.
