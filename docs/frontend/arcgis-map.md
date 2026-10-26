# ArcGIS 2D lifecycle and browser configuration

## Version and integration decision

On 2026-10-25, Esri's [current SDK documentation](https://developers.arcgis.com/javascript/latest/) identifies version 5.1. npm reported **5.1.27** for both `@arcgis/map-components` and `@arcgis/core`. These exact versions are installed in `@aq/web`, with the compatible required `@esri/calcite-components` **5.1.1** peer, and recorded in the lockfile.

Use the current `arcgis-map` and `arcgis-zoom` Web Components, following Esri's [React](https://developers.arcgis.com/javascript/latest/react/), [Vite](https://developers.arcgis.com/javascript/latest/vite/) and [map component](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-map/) references. This uses the component-owned 2D view, rather than creating a second `MapView` or copying a 4.x widget example. Individual component imports register the elements and supply their styles; the application supplies explicit host dimensions. Components are created inside an isolated imperative adapter so React's shell and page updates cannot replace the SDK-owned DOM.

`MapCanvas` lazily imports `arcgis-runtime` only when a nonblank public browser token exists. It cancels late initialization after unmount and starts at most one active map per mount, including React StrictMode's effect replay. The loader can be injected in tests to avoid importing SDK CSS/WebGL into jsdom. Runtime tests separately stub the actual SDK modules and exercise component event handling.

`mountMap` creates one `Map`, one `arcgis-map` and two graphics layers: the engineering extent and one station-observations layer. It registers readiness/loading-error listeners and a removable fatal-error watcher once. Updates change the existing layer visibility and WGS84 extent without rebuilding the map. Reapplying identical bounds does not reset a user's pan/zoom. Pollutant changes, station selection and drawer opening do not alter the geographic camera or recreate the view. Leaving Map Explorer destroys the component's view/map/layers and removes listeners/watchers; returning creates a fresh mount. `autoDestroyDisabled` permits explicit idempotent cleanup through the component's documented `destroy()`.

The engineering study extent is a dashed EPSG:4326 graphic; station graphics use the BFF source coordinates without jitter. It is not an official basin boundary or a fire hazard layer. Map zoom is bounded to 7–16 and rotation is disabled. Pan/zoom has no BFF observation-fetch listener; only the basemap SDK loads its normal visible tiles.

## Public browser token

Put the deliberately public token in the existing ignored **repository-root `.env`**:

```dotenv
VITE_ARCGIS_API_KEY=<public basemap-only token>
```

Vite now reads root `.env`; restart the dev server after changing environment values, and rebuild for production changes. `VITE_ARCGIS_API_KEY` is intentionally browser-visible by design and can appear in built assets and ArcGIS requests. Do not use an administrative token, an OAuth client secret or any server credential in this field. Follow [Esri API key authentication](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/): configure the least privilege needed for basemap styles and restrict HTTP referrers to the intended local and deployed app origins. Include the actual loopback host/port used for development (127.0.0.1 and/or localhost); do not use broad unrestricted referrers for a deployed key. Token restriction settings are managed in the owner's ArcGIS account and cannot be established by a successful map request alone.

Vite's environment prefix is narrowed to the browser token name prefix. AirNow/AQS/OpenAI/DB names are never exposed through Vite environment injection and are not imported by the web code. The application does not return, print or log any server configuration. The configured public token was used in an actual browser map check; its account privileges/referrer settings were not independently audited. No additional confirmation flag or credential-management flow is introduced.

`ALLOW_LIVE_API_TESTS` controls the separate server provider smoke path. ArcGIS basemap calls from the browser are independent of AirNow/AQS requests, and are not counted by `/api/usage/summary`.

## Availability and failure behavior

The fixed neutral basemap is `arcgis/light-gray`, accessed through the authenticated ArcGIS basemap style service. Esri attribution is retained. Tiles and SDK runtime assets require network availability, an accepted token/referrer, compatible browser/WebGL and service availability. Local-first does **not** promise offline tile maps. SDK assets are bundled/lazy-loaded by Vite, while some SDK workers, localization and service resources can still require network access; disconnected deployment is not implemented.

A missing token skips SDK initialization entirely. View initialization has a 15-second deadline. View readiness is followed by basemap load and base-layer view readiness; `arcgisLoadError`, `arcgisViewReadyError` and fatal view errors replace the map with a safe unavailable message and release its resources. There is no retry loop. Reload after repairing configuration/network. Availability of the map is separate from station metadata and from scientific data mode. The BFF reading list and shell remain usable when tiles cannot load. A successful readiness check does not guarantee every tile of a later extent will load; supported component load/fatal errors are observed continuously, while isolated tile failures may be handled internally by the SDK.

Default unit/E2E tests have no real keys and make no external tile/provider calls. The actual browser check additionally verified one view and one station layer across metric changes, drawer opening, station toggling and co-located hit tests, and view destruction on Analyze navigation. See [station layer semantics](station-observations.md) and [verification details](../milestones/04-station-observations.md).

Milestone 05 passes the selected shared engineering preset bbox into `MapCanvas`. The existing `update` changes extent/boundary without replacing the element, view or station layer. Pan/zoom still do not request observations. See [map interaction contract](map-interactions.md).
