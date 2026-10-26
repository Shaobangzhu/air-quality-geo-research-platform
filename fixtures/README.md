# Fixtures

`synthetic/site-observations.json` is invented, deterministic test data. Every ID uses `SAMPLE-`, every row labels its synthetic provenance, and all quality states are unknown. Coordinates are fictional examples inside the engineering extent; they do not identify actual monitors. These fixtures are not rendered as observations in the foundation shell.

`historical/` is reserved for separately curated official snapshots. None have been acquired. A future snapshot must retain source identifier/URL without credentials, acquisition UTC, observation/period semantics, validation status, licensing/attribution and any transformations. An old AirNow observation does not automatically become validated historical AQS data. Never move a synthetic fixture here or relabel it historical.

`synthetic/bff-hourly.json` is the milestone 02 application import fixture, not an AirNow wire response. It has 69 fictional observations over three pollutants and measurement kinds, co-located monitor identities, missing/zero/negative examples, and explicit sample provenance. The fixed requested end is `2026-01-15T21:00:00Z`; omitted times remain gaps. Importing it into PostgreSQL retains mode sample and does not make it eligible as official historical data.
