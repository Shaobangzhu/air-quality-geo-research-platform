CREATE TABLE aq_workbench.data_sources (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('synthetic', 'airnow', 'aqs')),
  label text NOT NULL,
  documentation_url text NOT NULL CHECK (position('?' in documentation_url) = 0),
  verification text NOT NULL
);
INSERT INTO aq_workbench.data_sources (id, provider, label, documentation_url, verification) VALUES
  ('synthetic-stations-v1', 'synthetic', 'SYNTHETIC SAMPLE — fictional monitors', 'fixture:bff-hourly-v1', 'synthetic-fixture-only'),
  ('airnow-hourly', 'airnow', 'AirNow hourly monitoring-site observations', 'https://docs.airnowapi.org/webservices', 'capability-documented-wire-contract-unverified'),
  ('epa-aqs', 'aqs', 'EPA AQS curated historical snapshots', 'https://aqs.epa.gov/aqsweb/documents/data_api.html', 'curation-required-no-adapter');

CREATE TABLE aq_workbench.monitoring_sites (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('synthetic', 'airnow', 'aqs')),
  native_site_id varchar(100) NOT NULL,
  monitor_identity varchar(100) NOT NULL,
  parameter_identity varchar(100) NOT NULL,
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  payload jsonb NOT NULL,
  UNIQUE (provider, native_site_id, monitor_identity, parameter_identity)
);
CREATE TABLE aq_workbench.data_snapshots (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES aq_workbench.data_sources(id),
  data_mode text NOT NULL CHECK (data_mode IN ('sample', 'historical', 'live')),
  origin text NOT NULL,
  label varchar(160) NOT NULL,
  captured_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  result_state text NOT NULL CHECK (result_state IN ('complete', 'partial', 'empty')),
  observation_count integer NOT NULL CHECK (observation_count BETWEEN 0 AND 2000),
  content_hash char(64) NOT NULL,
  metadata jsonb NOT NULL CHECK (octet_length(metadata::text) <= 2000000),
  CHECK (window_end > window_start AND window_end - window_start <= interval '72 hours'),
  CHECK ((data_mode = 'sample' AND origin = 'synthetic' AND source_id = 'synthetic-stations-v1') OR
         (data_mode = 'historical' AND origin = 'official-historical' AND source_id <> 'synthetic-stations-v1') OR
         (data_mode = 'live' AND origin = 'provider-live' AND source_id <> 'synthetic-stations-v1')),
  UNIQUE (data_mode, source_id, content_hash)
);
CREATE TABLE aq_workbench.observations (
  snapshot_id uuid NOT NULL REFERENCES aq_workbench.data_snapshots(id),
  id text NOT NULL,
  station_id text NOT NULL REFERENCES aq_workbench.monitoring_sites(id),
  pollutant text NOT NULL CHECK (pollutant IN ('PM2.5', 'PM10', 'O3')),
  measurement_type text NOT NULL CHECK (measurement_type IN ('aqi', 'concentration')),
  observed_at timestamptz NOT NULL,
  unit text NOT NULL,
  value double precision,
  raw_value double precision,
  period_key char(64) NOT NULL,
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 8192),
  PRIMARY KEY (snapshot_id, id),
  CHECK ((measurement_type = 'aqi' AND unit = 'AQI' AND (value IS NULL OR value >= 0)) OR
         (measurement_type = 'concentration' AND ((pollutant IN ('PM2.5','PM10') AND unit = 'µg/m³') OR (pollutant = 'O3' AND unit IN ('ppm','ppb')))))
);
CREATE TABLE aq_workbench.snapshot_imports (
  snapshot_id uuid PRIMARY KEY REFERENCES aq_workbench.data_snapshots(id),
  method text NOT NULL CHECK (method IN ('fixture', 'curated-file', 'live-fetch')),
  source_reference varchar(350) NOT NULL CHECK (position('?' in source_reference) = 0),
  diagnostics jsonb NOT NULL CHECK (octet_length(diagnostics::text) <= 8192)
);
CREATE INDEX observations_station_time ON aq_workbench.observations (station_id, pollutant, measurement_type, observed_at);
CREATE INDEX snapshots_mode_captured ON aq_workbench.data_snapshots (data_mode, captured_at DESC, id);
