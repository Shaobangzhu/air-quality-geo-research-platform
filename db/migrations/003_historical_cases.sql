CREATE TABLE aq_workbench.historical_cases (
  case_id text PRIMARY KEY CHECK (case_id = 'eaton-fire-2025'),
  snapshot_id uuid NOT NULL REFERENCES aq_workbench.data_snapshots(id),
  manifest_hash text NOT NULL CHECK (length(manifest_hash) = 64),
  manifest jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE aq_workbench.historical_cases IS 'Immutable curated historical case manifest; official source versions and asset checksums.';
