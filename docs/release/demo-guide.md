# A 4–5 minute technical interview demo

Before the interview, follow [README startup](../../README.md), check `/api/health`, seed the dedicated database for stored-snapshot demonstrations, and load all pages once. Use 1440×1000 or 1280×1000. The keyless path is deterministic; online maps additionally need internet and a permitted public ArcGIS token. If tiles fail, say so and use accessible tables/context selectors. Do not call that an offline basemap.

| Time      | Show                                                                                  | Explain                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | `/map?mode=sample&measurementType=concentration`                                      | “These monitor examples are synthetic. I separate repeatable demonstrations from real source evidence.”                                                                                                                                     |
| 0:30–1:15 | Inspect **SYNTHETIC SAMPLE Alpha co-located**, switch pollutant, return to PM2.5      | Three compact selectors, exact monitor identity, independent AQI/concentration and source status. Concentration symbols are not health colors. Click **Analyze This Station**.                                                              |
| 1:15–2:10 | Analysis → 72 hours → add two comparisons; inspect a null hour                        | “One bounded acquisition feeds three compatible series. Zero/negative values remain values; missing data breaks the line. The first 48 hours are outside this sample's coverage.” Show UTC plus PST/PDT and reloadable URL state.           |
| 2:10–3:15 | **Wildfire Case Study** → hazard list → **Later checkpoint → 05:00 PST**              | “The incident ran Jan 7–31; the study covers Jan 6–8. The archived perimeter stays fixed. LRA 2025 recommendations postdate ignition. The missing Jan 8 hour stays missing.” One monitor cannot establish exposure or causality everywhere. |
| 3:15–4:10 | **View Data & Methodology** → Sources → Preview & Export → Load preview → Export JSON | 71 official EPA rows, unknown certification, source versions/checksums, preserved qualifiers and four source-manifest summaries. CSV includes a manifest row and lossless record JSON.                                                      |
| 4:10–4:45 | API Usage, architecture and test evidence                                             | “These are measured counters since server start. Local browsing makes zero AirNow/AQS calls. ArcGIS traffic is outside these counters. Local results and remote CI are verified separately.”                                                |

Use [actual screenshots](screenshots/) if network conditions prevent a map presentation, identifying them as prior captures. Their date/environment is in the [freeze review](../milestones/10-v1-freeze-review.md).

## Supported research questions

- Which supplied PM2.5 hours at 06-037-1103 / POC 3 are absent or qualified during Jan 6–8? Which source revisions and uncertainty accompany them?
- How does the monitor relate spatially to the archived perimeter and separately dated SRA/LRA layers? What cannot be inferred from overlap?
- How do missingness, units and averaging period constrain monitor comparison?

This cannot attribute a change to the fire, traffic or a specific source; estimate individual exposure; reconstruct hourly fire spread; or validate present-day risk.

## Recovery

Unavailable Live is expected: no production AirNow codec is enabled. Choose explicit Sample or explicit Eaton history. Database failure does not prevent file-backed Sample/Eaton inspection; stored snapshots require PostgreSQL. Use **Refresh catalog** for a catalog error; reload after an API restart. Preserve database credentials/volumes and use the existing target's start command; do not rerun initial provisioning to repair a stopped container.
