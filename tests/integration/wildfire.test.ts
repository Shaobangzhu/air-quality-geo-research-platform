import { afterAll, beforeAll, expect, it } from 'vitest';
import { readConfig } from '../../apps/api/src/config.js';
import { createDatabase } from '../../apps/api/src/database.js';
import { migrate } from '../../scripts/migrations.js';
import { seedHistoricalCase } from '../../apps/api/src/wildfire/seed.js';
import { loadWildfireCase } from '../../apps/api/src/wildfire/case.js';
import { PgSnapshots } from '../../apps/api/src/bff/repository.js';
const config = readConfig();
const db = createDatabase(config);
beforeAll(async () => {
  if (
    process.env.ALLOW_DB_TESTS !== 'true' ||
    !config.DATABASE_URL ||
    new URL(config.DATABASE_URL).pathname !== '/air_quality_geo_research_test'
  )
    throw new Error('Confirmed test target required.');
  await migrate(db.pool!);
});
afterAll(async () => db.close());
it('repeats a real historical seed without rewriting prior snapshots, and rejects a different case version', async () => {
  const data = loadWildfireCase();
  const pool = db.pool!;
  const before = await pool.query(
    'SELECT id,content_hash FROM aq_workbench.data_snapshots ORDER BY id',
  );
  const first = await seedHistoricalCase(pool, data);
  const second = await seedHistoricalCase(pool, data);
  expect(second).toBe(first);
  expect(await new PgSnapshots(pool).load(first)).toEqual(data.batch);
  const after = await pool.query(
    'SELECT id,content_hash FROM aq_workbench.data_snapshots ORDER BY id',
  );
  for (const row of before.rows) expect(after.rows).toContainEqual(row);
  const stored = await pool.query(
    'SELECT manifest FROM aq_workbench.historical_cases WHERE case_id=$1',
    [data.manifest.id],
  );
  expect(stored.rows[0].manifest).toEqual(data.manifest);
  const modified = structuredClone(data);
  modified.manifest.limitations.push('Changed version');
  await expect(seedHistoricalCase(pool, modified)).rejects.toThrow('differs');
});
