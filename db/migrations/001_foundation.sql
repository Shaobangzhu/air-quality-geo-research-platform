-- Runner creates and owns aq_workbench migration metadata in the same transaction.
-- Domain storage and ingestion belong to later milestones.
CREATE TABLE aq_workbench.foundation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project text NOT NULL CHECK (project = 'air-quality-geo-research-platform'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO aq_workbench.foundation (project) VALUES ('air-quality-geo-research-platform');
