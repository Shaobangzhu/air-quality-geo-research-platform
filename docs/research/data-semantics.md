# Scientific data semantics

This workbench demonstrates traceable data engineering. It does not provide regulatory findings, operational fire predictions or individual exposure estimates.

## Measurement and identity

AQI is an index, not concentration. `measurement.kind` separates `aqi` (unit AQI) from `concentration` (PM2.5/PM10: µg/m³; O3: ppm or ppb). No unit conversion or AQI calculation is implemented. Retain raw values, raw units/parameter names and qualifiers. Small negative concentrations may reflect measurement/processing behavior; preserve them for review instead of automatically rejecting/clipping. `null` is missing; zero is zero. Missing does not mean clean air.

Site IDs are strings with leading zeroes preserved. A reporting area is not a monitoring site; its representative coordinate does not identify an instrument. Observations, forecasts and contours remain separate. Later raw-to-normalized transformations require explicit documentation.

The WGS84 (EPSG:4326) box is west −119.05, south 33.35, east −116.70, north 34.60. It is an engineering study extent, not an air-basin boundary. Ordered bboxes do not support antimeridian crossing in V1; region selection accepts only Greater LA.

## Quality, provenance and modes

AirNow data is preliminary and subject to change; regulatory historical work requires AQS/AirData. Age does not validate an observation. Preserve preliminary/validated/unknown states with source evidence; do not infer every AQS row is validated without inspecting quality/completeness flags. Sources: [AirNow policy](https://docs.airnowapi.org/), [AQS API](https://aqs.epa.gov/aqsweb/documents/data_api.html).

Retain provider, credential-free source identifier, origin, label and fetch UTC. Never persist signed/credential-bearing query URLs in provenance. Observation time and fetch time are distinct.

`live` requests provider access; `historical` uses separately curated official snapshots with acquisition/quality metadata; `sample` is fictional synthetic data. `unavailable` is a state within the requested mode. The BFF loads explicitly synthetic sample observations and reads identified curated historical snapshots; live is contract-unverified and never silently falls back. Synthetic fixtures require SAMPLE- IDs, sample labels and unknown validation status. No official historical fixtures exist yet.

## Time and averaging

Internal instants are valid ISO UTC strings ending in Z. Display using `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'` and explicit date/time/zone labels. DST changes display offsets; never assume a fixed UTC−8 offset or parse ambiguous local strings as UTC. Repeated autumn hours require source offset/zone disambiguation; nonexistent spring times need explicit handling.

Preserve source conventions before conversion: UTC, Local Standard Time and local civil time with DST differ. Interpret daily aggregations using the provider's documented source date/time convention, not midnight UTC or an assumed 24-hour local day. `period.meaning` and `averagingDescription` retain hourly/daily/NowCast/unknown semantics. Start/end instants are nullable when boundaries cannot be established; do not fabricate precision.

AirNow's [AQI overview](https://docs.airnowapi.org/aq101) distinguishes real-time NowCast and historical daily AQI. One hourly concentration is not a daily AQI. Forecasts are predictions, not observations: retain issue time when known and ordered validity bounds. An observed value must not overwrite original forecast semantics.

## Spatial interpretation

Official contours are provider products. Label any later interpolated surface derived and retain its method/inputs. Neither a contour nor a nearby site establishes exact exposure at an arbitrary coordinate.

[CAL FIRE historical perimeters](https://www.fire.ca.gov/what-we-do/fire-resource-assessment-program/fire-perimeters) have missing fires and attribute/geometry errors; absence of a polygon is not proof of no fire. [FHSZ layers](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/%E2%80%8Cfire-hazard-severity-zones) provide longer-term hazard context. Preserve SRA/LRA designation/adoption context. Hazard zones are not current spread, current risk predictions or smoke exposure. Elevation is terrain context, not evidence of pollution causation. Case studies must disclose spatial/temporal alignment and cannot infer wildfire causation from coincident AQI alone.
