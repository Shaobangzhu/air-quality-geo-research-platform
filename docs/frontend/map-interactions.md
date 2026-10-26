# Map interaction contract — milestone 05

Map Explorer owns spatial context and one station drawer. Analysis receives the selected station for the later time-series module. Wildfire layers, reporting areas, forecasts, export and usage dashboards are separate responsibilities. The map toolbar contains Region, Pollutant and Data Product; the existing page controls choose data mode and map metric.

## Engineering region presets

All coordinates are WGS84 / EPSG:4326, ordered west, south, east, north. These rectangles are application study presets, **not official CARB air basins, county boundaries or monitoring-network coverage**. They are frozen metadata in `@aq/contracts`, shared by the toolbar, map extent, BFF validation and response metadata.

| ID              | Label         | West    | South | East    | North | Engineering basis                                                                                           |
| --------------- | ------------- | ------- | ----- | ------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `greater-la`    | Greater LA    | -119.05 | 33.35 | -116.70 | 34.60 | Retained parent study envelope from Prompt 01                                                               |
| `coastal-la`    | Coastal LA    | -118.65 | 33.65 | -118.10 | 34.15 | Smaller west/central LA and adjacent coastal urban study window, including the Long Beach vicinity          |
| `inland-empire` | Inland Empire | -117.85 | 33.75 | -116.70 | 34.35 | Eastern urban/foothill study window around Ontario, San Bernardino and Riverside within the parent envelope |

The preset labels are geographic shorthand. Their rounded bounds are deliberate study choices rather than digitized legal features. No formal shapes are fabricated. Every bbox has west < east, south < north and stays inside Greater LA; antimeridian crossing is unsupported. A caller-supplied BFF bbox must also stay within the selected preset. Edges are included. Selecting a preset updates the existing extent graphic and component extent without constructing another map/view. Source coordinates are never moved.

The unchanged fixture has three monitor identities per pollutant at two locations. Coastal LA contains the two co-located Alpha identities; the Beta location (-117.9, 33.9) lies outside both smaller presets. Inland Empire therefore returns zero sample identities. An empty preset does not imply that a real region has no monitoring sites. The UI says, for example, “No PM10 stations reported in this region and time window.” No DB or fixture changes manufacture coverage.

## Pollutants, products and source modes

Public queries and URLs use exactly `PM2.5`, `O3`, `PM10`. BFF `normalizePollutant` keeps canonical domain values separate from the verified [EPA AQS parameter table](https://aqs.epa.gov/aqsweb/documents/codetables/parameters.html): 88101 → PM2.5 (local conditions), 44201 → O3, 81102 → PM10 (STP). Recognized AQS raw parameter codes that contradict a normalized measurement are rejected with safe row diagnostics. Unknown codes are not guessed; numeric identifiers, aliases and provider codes are not accepted as canonical API query pollutants. Raw parameter IDs, units and averaging semantics remain intact. This bounded mapping does not implement an AQS adapter or establish equivalence across other parameter codes.

AirNow request/response wire codes remain unverified; the production codec stays absent. The browser never sends a provider key or calls an air-quality provider. Monitoring Stations retains its existing observation path. Milestone 07 enables Reporting Area AQI and Forecast only as explicitly synthetic sample alternatives; official Live/Historical choices remain disabled because their detailed contracts/archives are unavailable. No unsupported option becomes a result mode. The product helper states whether monitoring observations are synthetic, require an official historical snapshot, or have an unverified live contract. The BFF product catalog remains monitoring-site observations only, supporting supplied AQI/concentration for the three pollutants.

Sample, historical and live retain distinct provenance and failure states. Empty is a successful result; unavailable is a source/API failure. There is no implicit sample fallback. Selecting historical without a valid identified snapshot shows its requirement and makes no observation request.

## URL and history

| Field             | Accepted state                               |
| ----------------- | -------------------------------------------- |
| `region`          | Three IDs above; default `greater-la`        |
| `pollutant`       | `PM2.5` default, `O3`, `PM10`                |
| `product`         | `monitoring-stations` only                   |
| `mode`            | `sample` default, `historical`, `live`       |
| `measurementType` | `concentration` default or `aqi`             |
| `stationId`       | Opaque `s_` plus 32 lowercase hex characters |
| `snapshotId`      | UUID retained only for historical mode       |

A legacy `station` parameter still parses when `stationId` is absent. Duplicate/malformed fields fall back to safe defaults; unknown parameters are omitted. Initial load and popstate canonicalize allowed state with `replaceState`. Filter/explicit selection changes push history; identical state is a no-op. Automated invalid-selection cleanup replaces the active entry so Back can recover an earlier valid selection. Credentials and full records never appear in URLs.

Region, pollutant and metric changes retain the candidate station ID while loading. The drawer and symbols clear immediately with old-context data. When the active response arrives, an exactly matching identity reopens; an absent identity is cleared from the URL with a non-alarming status message. A different monitor or pollutant-specific parameter identity is never substituted based only on name or coordinates. Errors retain the pending URL identity because a failed request cannot prove deletion. Mode changes explicitly clear selection and historical snapshot context. Reload restores a valid map deep link; Back/Forward replay validated state.

All route patches merge against the latest synchronous location reference. This prevents a selection-cleanup callback from restoring an old pollutant/region during rapid updates. Native links preserve modified-click/new-tab behavior. Analyze This Station carries the exact validated station, region, pollutant, mode, metric and applicable historical snapshot into `/analysis`; milestone 06 implements that chart module with bounded monitoring-site series.

## Interaction state machine

| State / event                                     | Result                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Start or changed request context                  | Loading; cancel/ignore earlier request; clear old symbols/drawer; retain candidate selection |
| Active valid response, candidate present          | Ready; update existing graphics and reopen the matching drawer                               |
| Active valid response, candidate absent           | Ready/empty; clear candidate with history replacement and explanation                        |
| Active valid empty response                       | Honest pollutant/region/window empty message; no fabricated observations                     |
| Active failure or malformed/mismatched response   | Unavailable; safe mode-specific message; no cross-context data                               |
| Superseded response, even if a mock ignores abort | Ignore; do not alter current symbols, drawer, URL or availability                            |
| Map click / keyboard list selection               | Select exact opaque ID; co-located hits offer a monitor chooser; no new read                 |
| Escape / Close                                    | Clear selection, restore focus to its identity button; no new read                           |
| Region / pollutant / metric filter                | New context read; update extent/rendering on the current view                                |
| Legend collapse / visibility / pan / zoom         | Local map state; no observation read                                                         |
| Analyze                                           | Navigate with validated context; dispose map on exit; no extra read for unchanged context    |

`useStations` validates response shape, mode, pollutant, metric, selected preset ID/bbox and requested snapshot before accepting data. Its key excludes selection, visibility and rendering. Cleanup aborts the request and marks its promise inactive; a key guard also prevents old data appearing during render. The request deadline remains 12 seconds. There is one component-owned view and one station GraphicsLayer per map mount. Region/filter updates reuse them. SDK imports and lifecycle remain unchanged; the current [map component API](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-map/) documents extent updates, hit testing and explicit destruction. Real tile availability is checked separately from mocked lifecycle tests.

## Symbols and keyboard access

The [station observation contract](station-observations.md) remains authoritative: supplied AQI uses six category ranges, concentration uses independent blue display bins with each supplied unit, and missing/stale/ambiguous values use a neutral diamond. A negative concentration uses a triangle. Dark outlines, numeric values, units, category/range text and reason labels accompany colors. No concentration threshold is presented as an AQI category. Underlying times remain UTC; display uses America/Los_Angeles with PST/PDT.

Native labeled selects support keyboard filters; disabled product options have explanatory text. The legend button exposes `aria-expanded`/`aria-controls`. The monitor list provides an equivalent route to every selectable graphic, including co-located identities and when tiles fail. A selected button exposes `aria-pressed`; opening a drawer focuses Close, and Escape restores list focus. Loading/empty/selection cleanup use status announcements; source failures use an alert. The existing responsive layout stacks the drawer on narrow screens without horizontal overflow. No modal focus trap is applied to this nonmodal region.

## Cache and verification

BFF response `meta.region`/`bbox` describe the requested preset; `availableCoverage` and stored snapshots retain the original acquired batch coverage. All three presets share the parent Greater LA fetch/cache identity for a fixed mode, pollutant, metric, interval and snapshot. Sub-bbox/pagination changes filter that batch after acquisition. Concurrent preset requests coalesce. Pollutant/metric/time/mode/snapshot still partition cache entries because a future verified provider may supply only that requested product. No broadening of an acquired batch or source coverage is implied.

The Prompt 02 usage service measures server provider attempts and cache lookups. Browser ArcGIS tiles are excluded. Tests and the real browser measure usage before/after interactions, with no Usage cards on the map. Initial development StrictMode effects may start and cancel an extra read, and explicit reload makes fresh browser requests; neither is reported as provider fan-out. See the [Prompt 05 report](../milestones/05-linked-interaction.md) for commands, measured deltas and limitations.

See [milestone 07 area-product routing/rendering](reporting-area-products.md). The map/view is reused while the station layer is hidden/cleared; area products never enter the Analysis observation chart.
