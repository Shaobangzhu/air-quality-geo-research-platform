# Prompt 08 — Eaton Fire historical GIS showcase

## Delivered scope

The agreed scope realignment is implemented: one `/wildfire` historical case, a 2D terrain map, static historical perimeter, independently toggleable SRA/LRA hazard context, one real EPA monitoring identity, three observation checkpoints and contextual details. The four-page navigation remains intact. The Data page has a narrow case-provenance view; full export/metrics remain future work. No AI, smoke model, live wildfire service, 3D, deployment, commit or push.

## Sources, dates and scientific boundary

See the [one-page source feasibility log](../data-sources/eaton-case-feasibility.md) for official links, acquisition queries and versions. See the committed [manifest](../../fixtures/historical/eaton-fire-2025/manifest.json) for exact retrieval timestamps and artifact/original-download SHA-256 hashes.

- Event: 2025 Eaton Fire, Jan 7 start, Jan 31 containment, documented by CAL FIRE; FRAP LAC incident 00009087 and IRWIN 72660ADC-B5EF-4D96-A33F-B4EA3740A4E3. No inferred incident acreage/damage numbers.
- Study: Jan 6–8, 2025 PST, i.e. Jan 6 08:00 UTC through Jan 9 08:00 UTC, exclusive end. This is not the entire incident lifetime.
- AirData: hourly_88101_2025 archive listed as of June 25, 2026. Site 06-037-1103, POC 3, parameter 88101, method 170; 71 source rows out of 72 slots. Jan 8 05:00 PST is absent. 47 unflagged, 17 IT, 7 IJ rows. Original WGS84 location, GMT/local timestamps, units, qualifiers and revision dates (April 22, 2025–March 26, 2026) retained. Row certification unknown; no regulatory/causal inference from historical age or qualifiers.
- FRAP: firep25_1 released April 2026, one static historical perimeter. Its service ALARM_DATE date representation is retained in the raw feature, not substituted for CAL FIRE's local incident start date. No progressive perimeter animation.
- SRA: FHSZSRA_23_3, same geographic representation as Sept 29, 2023 public-comment release, effective April 1, 2024. 31 selected polygons.
- LRA: FHSALRA25_v1_All, OSFM 2025 recommendations, statewide phased release Feb 10–Mar 24; 19 classified selected polygons. These postdate ignition; local adoption/effective date is not established. No Low category fabricated from NonWildland or unmapped gaps.
- Geometry: source projection to WGS84, Shapely 2.1.2 topology repair for invalid nested shells/self-intersections, hazard clipping to [-118.25,34.04,-117.95,34.30], no simplification. Display derivatives retain source feature IDs and original-download hashes. The repaired boundary is not a new official geometry version. The offline audit re-derived and matched every artifact hash.

The first mountain-only bbox returned no selected hourly records; expanding south includes a documented contextual monitor. That monitor does not represent exposure within the fire. Hazard and terrain context cannot establish causation. Terrain is topographic basemap relief, not a smoke simulation. FHSZ is long-term hazard, not immediate risk, damage or evacuation guidance.

## Storage and repeatability

Committed small assets are in `fixtures/historical/eaton-fire-2025`: manifest, three display GeoJSON layers, exact selected EPA CSV rows as JSON, and the normalized import manifest. The original ~68.6 MB 88101 and ~12.8 MB 88502 ZIPs and raw service responses remain ignored in `.local/milestone08`. The 88502 exploration supplied no selected records and is not a displayed source.

Migration `003_historical_cases.sql` is additive and leaves migrations 001/002 untouched. Existing `PgSnapshots` stores the official rows; `historical_cases` stores an immutable manifest linked to that snapshot. The dedicated development database is `air_quality_geo_research` on the authorized local project container; no other containers/databases were queried or modified.

```sh
npm run db:migrate
npm run db:seed:historical-case -- --target air_quality_geo_research
```

Two seed runs returned the same development snapshot **332c4c1e-9ccf-40d7-bfbd-4444744e7af7**, 71 observations. A different manifest version is refused rather than overwriting the case. Tests additionally compare pre-existing snapshot hashes before/after and exercise repeated import in `air_quality_geo_research_test`. No database reset/drop/delete. Startup and page reads use the identical checked-in local snapshot, so the demo remains usable without a database connection; seed persistence is independently verified, not a claim that every page read queries PostgreSQL.

Optional source re-derivation, using the original retained downloads and ignored Shapely 2.1.2 tooling environment:

```sh
.local/milestone08/geo-tools/bin/python scripts/verify-eaton-sources.py .local/milestone08
```

## Verification

Final local checks passed:

| Command / check                  | Result                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                   | ESLint and Prettier passed                                                                                                   |
| `npm run typecheck`              | Strict contracts, API, web and tools passed                                                                                  |
| `npm test`                       | 178 tests / 20 files passed                                                                                                  |
| `npm run test:db:local`          | 5 tests / 3 files passed against the separate confirmed test DB                                                              |
| `npm run build`                  | Passed; entry JS 414.19 kB / 124.60 kB gzip; existing large ArcGIS lazy-chunk warning retained                               |
| `npm run test:e2e`               | 12 Chromium tests passed, isolated ports 5174/3103, no provider keys                                                         |
| `git diff --check`               | Passed                                                                                                                       |
| Offline source re-derivation     | All three GeoJSON artifact hashes and all 71 original EPA rows matched                                                       |
| Real configured ArcGIS browser   | 31 SRA / 19 LRA / 1 perimeter / 1 monitor; successful terrain basemap and actual pointer hits on monitor and hazard polygons |
| View lifecycle / passive actions | Same element/view across toggles/checkpoints; fixed perimeter; zero extra case requests                                      |
| Responsive inspection            | Screenshots at 1440, 1280 and 390 px; no horizontal overflow; 1440 and 390 reviewed visually                                 |

Credential check: all 1,121 JS/CSS/HTML assets emitted by the final Vite build were scanned against configured server-only AirNow/AQS/OpenAI credentials, AQS email and database URL; zero matches. The deliberately public ArcGIS credential is excluded. `ALLOW_LIVE_API_TESTS` remains false. An initial directory-wide scan stalled on stale duplicate generated files (names ending ` 2.js`); those scanner processes were stopped and the exact current-build inventory was checked successfully. Stale unrelated copies were not deleted.

Browser runtime errors: zero. Browser AirNow/AQS/OpenAI calls: zero. Missing Jan 8 05:00 record verified in UI. Existing mocked map tests cover delayed initialization, tile-loading failure and fatal-view cleanup; keyless E2E verifies accessible context despite unavailable basemap. Sample/live case requests fail explicitly. Remote CI, Firefox and WebKit were not run.

Screenshots: `.local/milestone08/wildfire-1440.png`, `wildfire-1280.png`, `wildfire-390.png`. Machine-readable evidence: `.local/milestone08/browser-verification.json` and `hit-verification.json`. Local development preview is running on port 5173; the test processes ended normally.

Initial test execution needed loopback permission (sandbox EPERM); rerunning with loopback access resolved it. A jsdom fixture loader initially received a browser-style import.meta URL; the test now supplies an explicit file URL. An early E2E station test saw 502 responses while concurrent contract builds restarted the test API; the final E2E rerun after writes/builds settled passed all 12 tests. None of these failures were papered over by changing expected scientific behavior.

## P0 / P1 and Prompt 09

A01: acquired official case and real historical observations. A02: official versions, jurisdiction distinction and display transformations explicit. A03: terrain/location context and real measurements; no fabricated smoke. A04: supported coverage/checkpoints, fixed perimeter. A05: additive repeatable local seed, bounded offline data and all local/browser checks passed. P0 is complete with the scientific limits above.

P1 3D, official AirNow contours and smoke/wind are unavailable. The public AirNow catalog/2026 update establishes retained KML families but not the reviewed request/time contract or availability of January 2025 contours. No paid/authenticated call was attempted. This does not weaken P0 source evidence.

Prompt 09 can reuse the manifest, case-source UI and immutable historical snapshot for provenance/export. Full Data & Methodology/export/metrics implementation remains to be scoped by its actual prompt. It must retain qualifiers/revisions, immutable source dates/checksums and the distinction between official raw geometry and display derivatives.
