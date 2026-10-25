import { afterAll, beforeAll, expect, it } from 'vitest';
import { readConfig } from '../../apps/api/src/config.js';
import { createDatabase } from '../../apps/api/src/database.js';
import { migrate } from '../../scripts/migrations.js';

// Only run against a separately provisioned, project-owned test DB. No cleanup drops.
const config = readConfig(process.env);
const database = createDatabase(config);
beforeAll(() => {
  if (
    process.env.ALLOW_DB_TESTS !== 'true' ||
    !config.DATABASE_URL ||
    new URL(config.DATABASE_URL).pathname !== '/air_quality_geo_research_test'
  ) {
    throw new Error(
      'Set ALLOW_DB_TESTS=true and a confirmed air_quality_geo_research_test target.',
    );
  }
});
afterAll(async () => {
  await database.close();
});
it('applies and repeats migrations without changing foundation data', async () => {
  const pool = database.pool!;
  expect(await database.status()).toBe('connected');
  await migrate(pool);
  const before = await pool.query('SELECT * FROM aq_workbench.foundation');
  expect(await migrate(pool)).toEqual([]);
  const after = await pool.query('SELECT * FROM aq_workbench.foundation');
  expect(after.rows).toEqual(before.rows);
  expect(after.rows).toHaveLength(1);
  expect(after.rows[0].project).toBe('air-quality-geo-research-platform');
  const history = await pool.query(
    'SELECT name, checksum FROM aq_workbench.schema_migrations',
  );
  expect(history.rows).toHaveLength(1);
  expect(history.rows[0].checksum).toMatch(/^[a-f0-9]{64}$/);
});
