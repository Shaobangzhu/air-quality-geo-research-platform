import type { Pool } from 'pg';
import { wildfireCaseSchema } from '@aq/contracts';
import type { WildfireCase } from '@aq/contracts';
import { PgSnapshots } from '../bff/repository.js';
import { hash } from '../bff/normalize.js';
export async function seedHistoricalCase(pool: Pool, input: WildfireCase) {
  const data = wildfireCaseSchema.parse(input);
  const digest = hash(data.manifest);
  // Refuse a different case version before adding a snapshot; never rewrite an existing case.
  const existing = await pool.query<{
    manifest_hash: string;
    snapshot_id: string;
  }>(
    'SELECT manifest_hash,snapshot_id FROM aq_workbench.historical_cases WHERE case_id=$1',
    [data.manifest.id],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].manifest_hash !== digest)
      throw new Error(
        'Existing case version differs; explicit version migration required.',
      );
    return existing.rows[0].snapshot_id;
  }
  const id = await new PgSnapshots(pool).save(data.batch);
  await pool.query(
    'INSERT INTO aq_workbench.historical_cases(case_id,snapshot_id,manifest_hash,manifest) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(case_id) DO NOTHING',
    [data.manifest.id, id, digest, JSON.stringify(data.manifest)],
  );
  const saved = await pool.query<{
    manifest_hash: string;
    snapshot_id: string;
  }>(
    'SELECT manifest_hash,snapshot_id FROM aq_workbench.historical_cases WHERE case_id=$1',
    [data.manifest.id],
  );
  if (saved.rows[0]?.manifest_hash !== digest)
    throw new Error('Conflicting immutable case.');
  return saved.rows[0].snapshot_id;
}
