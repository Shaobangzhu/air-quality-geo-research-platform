# Prompt 03 — Research Dashboard + ArcGIS Shell

**Repository:** `Shaobangzhu/air-quality-geo-research-platform`  
**Track:** Core V1 · Map Explorer foundation and shared design system  
**Recommended Codex effort:** Medium–High

## 1. Role and Execution Mode
Act as a senior React/TypeScript and ArcGIS UI engineer. Examine the actual repository, current SDK version, BFF contracts, and existing styling before implementation. Build, test and document functional UI; preserve user work. Do not commit or push. Never fabricate live monitoring measurements or pretend a generated design mockup is verified data.

## 2. Repository Context
**Visual reference:** `references/ui/01-map-explorer.png` (if supplied to Codex) is a *styling/layout mockup only*, not authoritative data or a feature mandate. Follow this prompt for actual scientific data, supported controls, and status.

Product name: **Greater LA Air Quality Geo Research Platform**. Subtitle: **Interdisciplinary Research & Software Engineering Workbench — v1**. Four fixed top-level routes: `/map` Map Explorer, `/analysis` Analysis, `/wildfire` Wildfire Case Study, `/data` Data & Methodology. The approved visual direction from the design concepts is a light, professional desktop research workbench: white/light blue background, restrained cobalt-blue primary actions, rounded panels, generous map canvas, compact toolbar and legible sans-serif type. **One page, one function**, no extra dashboard, notes, Settings or AI navigation. Vite/React and Express BFF are local-first; Docker PostgreSQL is already managed by the user.

## 3. Objective
Establish the shared responsive application shell, navigation, data-status vocabulary, functional Map Explorer layout, and a persistent ArcGIS 2D map lifecycle. Show only data that actually exists in the BFF or explicitly tagged sample fixtures. Other three routes can have clear, non-interactive, truthful milestone placeholders until implemented.

## 4. Scope
1. **Design tokens:** colors, typography, spacing, radii, focus/hover states, loading/error/empty patterns, consistent header/buttons/selects/cards. Reusable components should be small and avoid a big third-party UI library if not necessary. Keyboard accessibility and reasonable 1280–1440px desktop layout.
2. **Global header:** mountain/map brand icon, product name, subtitle, four navigation links with current route highlighted, and a truthful `Live`, `Historical`, `Sample`, or `Unavailable` mode/status label. These labels must represent actual selected data, not decoration. No global search, date or pollutant selectors; filters live only on their owning page.
3. **Map Explorer `/map`:** compact toolbar with `Region`, `Pollutant`, `Data Product`; large center ArcGIS map; collapsible map Layers & Legend overlay; station-details right drawer **only after selection**; a brief preliminary data disclaimer. No full trend chart on map. If station data is not yet implemented, label the map as an empty shell or clearly synthetic data.
4. **ArcGIS SDK integration:** install a **supported** current npm SDK and determine whether map web components or direct MapView are appropriate at the installed version. Avoid copying incompatible 4.x examples into a 5.x SDK. Maintain one stable map/view per mount, update layers and extent reactively, clean up on unmount and avoid duplicate event listeners. Support WGS84 region bounds and a safe base map. Browser ArcGIS API key must be least-privilege, referrer-restricted and explicitly recognized as public-facing; AirNow/AQS/OpenAI/DB credentials remain server-only.
5. **Page routing:** preserve selected `region`, `pollutant`, optionally station/mode through validated search parameters; provide safe defaults on invalid/deep-linked values. Links should work, and unavailable future page functionality should be labeled, not rendered as dead clickable controls.
6. **Graceful local-first behavior:** if ArcGIS tiles cannot load or ArcGIS key is absent, show a non-crashing, honest map-unavailable state and allow rest of shell to function. Local-first does not promise offline tile maps. No unbounded external calls from view changes.
7. **Docs:** frontend design system, route responsibilities, SDK version/auth configuration, basemap availability constraints and supported viewport sizes.

## 5. Technical Requirements
- Do not create multiple ArcGIS map instances when switching pollutant/region or opening a drawer.
- Avoid leaking client secrets; ArcGIS browser token can appear in client by design but must be restricted.
- Shared URL state should not serialize large environmental datasets.
- Respect measurement and source labels: AQI category colors apply only to AQI, concentration needs its own legend and unit.
- No chart duplication or source-provenance table here; those belong to `/analysis` and `/data`.

## 6. Implementation Instructions
Review current package versions and official https://developers.arcgis.com/javascript/latest/ docs. Implement design tokens and routing, Map Explorer toolbar/overlay/drawer layout, persistent ArcGIS view, error/status handling, safe BFF integration with existing contracts, route smoke components, docs, then tests. Make controls whose behavior is not yet implemented visibly disabled with an explanation instead of fake interactions. Keep the scope small and match existing concept-screen visual hierarchy rather than pixel-copying its synthetic data.

## 7. Testing and Verification
React Testing Library: header navigation, active page, keyboard navigation, data mode, validated URL params, empty/error map state, layer legend toggles when available, drawer visibility. Stub ArcGIS SDK in unit tests, test view setup/update/dispose behavior without external tiles. Playwright smoke test at `/map` with sample mode, page heading/toolbar, no network to AirNow required. Run lint, typecheck, unit tests, build and E2E. Manual review at 1440x900 and 1280 widths; check no overflow and no inaccessible color-only status.

## 8. Acceptance Criteria
- A01: recognizable shared UI matches approved four-page visual language, with no fifth page.
- A02: persistent ArcGIS map initializes if credentials/network available; unavailable map gracefully degrades otherwise.
- A03: Map Explorer layout includes three compact filters, map canvas, collapsible legend and conditional details drawer; no duplicate full charts.
- A04: navigation and validated deep links function.
- A05: unit/E2E tests and build pass using deterministic mocks; no invented live data or visible secrets.

## 9. Out of Scope
Real monitoring station layers/adapters beyond Prompt 02, data-driven symbol styling, pollutant linked analysis, historical time-series, wildfire study, CSV export, API usage UI, 3D SceneView, forecasts, AI, cloud deploy.

## 10. Final Report
Summarize changed files, screenshots if capture is supported, SDK/version decision, route design, key/token safety, commands run and results, browser/UI limitations, acceptance status, and dependencies for Prompt 04. **No commit or push.**
