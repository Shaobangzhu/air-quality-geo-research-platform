# Frontend workbench — milestone 03

The four supplied screens in `docs/uiux/` establish the visual direction: white and pale blue surfaces, dark blue text, restrained cobalt actions, rounded panels, a horizontal four-page header, a compact page toolbar and a generous map canvas. They are layout references only. Their stations, measurements, dates and availability badges are not verified data.

## Tokens and interaction patterns

Tokens live in `apps/web/src/style.css`; there is no additional UI framework. ArcGIS's required Calcite peer dependency supplies SDK internals, not the application shell.

| Token / pattern             | Value / behavior                                                       |
| --------------------------- | ---------------------------------------------------------------------- |
| Primary / hover             | `#075ce5` / `#0349bd`                                                  |
| Text / secondary            | `#10234b` / `#526586`                                                  |
| Page / panel                | `#f2f7fe` / white                                                      |
| Border / soft blue          | `#dce6f4` / `#edf4ff`                                                  |
| Panel radius / spacing base | 10px / 16px                                                            |
| Type                        | Local system sans-serif stack; no external font needed by the shell    |
| Focus                       | Visible 3px dark blue outline, 4px offset                              |
| Status                      | Text plus a decorative dot; never color alone                          |
| Loading                     | Explicit checking/loading text; previous context is hidden immediately |
| Error                       | Static safe explanation; no raw provider/SDK error or signed URL       |
| Empty                       | Valid empty station selection, separate from an API failure            |
| Unsupported controls        | Disabled with an adjacent explanation                                  |

Small shared `Icon`, `ModeBadge` and `StationDrawer` components keep shell patterns consistent. Native links, selects, buttons and checkboxes support keyboard use. A skip link targets the main workspace. SPA navigation moves focus to main; a selected station focuses its close button; Escape or Close dismisses the nonmodal drawer and returns focus to the initiating identity. The page title and `aria-current` follow the route. The drawer stacks below the map on narrow screens and does not trap focus.

## Route responsibilities

| Route         | Implemented responsibility                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` or `/map` | Map Explorer: region/pollutant/product context, page-owned data mode, geographic basemap/engineering extent, collapsible legend, available identity list and conditional metadata drawer |
| `/analysis`   | Truthful planned-module placeholder; no interactive charts or linked analysis                                                                                                            |
| `/wildfire`   | Truthful planned-module placeholder; no fire layer, hazard claim or study results                                                                                                        |
| `/data`       | Truthful planned-module placeholder; no export, source table or usage dashboard                                                                                                          |

There is no fifth page. Unknown paths show a recovery message within the same shell. The header badge reports the selected station context across routes; placeholders explicitly say they display no results. It is not an API health badge or a basemap availability claim.

## URL state and BFF reads

`route-state.ts` validates a small search-parameter vocabulary. Real `href` values support opening a link in another tab; normal clicks use the History API and Back/Forward uses `popstate` without a full reload.

| Parameter    | Validation / safe default                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `region`     | Only `greater-la`                                                                                          |
| `pollutant`  | `PM2.5`, `O3`, `PM10`; defaults to `PM2.5`                                                                 |
| `product`    | Only `monitoring-stations`                                                                                 |
| `mode`       | `sample`, `historical`, `live`; defaults explicitly to `sample`, independent of server default             |
| `station`    | Shared opaque station-ID schema; ignored when malformed, selected only if returned for the current context |
| `snapshotId` | UUID, preserved only in historical mode                                                                    |

Duplicate values are rejected to defaults. Unknown parameters are ignored and omitted from generated links. Invalid values are never reflected in the UI. Initial URLs are parsed safely; the first navigation/filter action writes the canonical allowed parameters. Datasets, credentials and full station records are never serialized into URLs.

`useStations` requests only `/api/stations`, with explicit mode, concentration semantics and the selected pollutant. BFF defaults provide the bounded 24-hour window and pagination. No station-observation values are fetched or plotted in this milestone. Responses are parsed using `@aq/contracts`, and mode/pollutant/measurement context must match the request. Requests have a 12-second browser deadline and are aborted/ignored on context change or unmount. The result is keyed by request context to prevent transient display of another pollutant or mode. Map navigation, a layer toggle, drawer selection and page navigation do not trigger BFF provider fan-out; the shared context remains mounted across pages. React StrictMode may initiate and cancel an initial development request; the BFF still provides cache/coalescing isolation.

Sample has three fictional monitor identities per pollutant, including co-located monitors. Each is labeled synthetic; coordinate equality does not merge identity. The identity list is usable even without tiles. The engineering extent is the only rendered operational layer. The station-symbol checkbox is visibly disabled pending Prompt 04. No AQI category colors, concentration scale, measurements or source-provenance table are fabricated.

Live requests currently produce the BFF's contract-unverified error. Historical mode requires an official `snapshotId`; no synthetic fallback occurs. The mode selector clears station/snapshot context when explicitly switching modes. A valid historical deep link retains its UUID. Empty results remain explicit. Stale metadata receives a visible stale warning, and a truncated page says additional identities are not displayed.

## Viewport support

Primary review targets are **1440×900 and 1280×900**. At these widths the header uses a compact brand/status row plus horizontal navigation, and the selected drawer sits to the right of the map. Larger desktops can use a single header row. At ≤1100px filters reflow; at ≤750px navigation becomes a two-column grid, filters stack and the drawer follows the map. A 390×900 smoke check verifies overflow and navigation. The minimum supported CSS width is 320px; 320px and other browser engines were not separately verified. Pages may scroll vertically. All three checked widths retain usable controls with and without selection.

See [ArcGIS lifecycle and authentication](arcgis-map.md) and the [milestone report](../milestones/03-arcgis-shell.md).
