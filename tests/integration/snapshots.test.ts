import { afterAll, beforeAll, expect, it } from 'vitest';
import { createDatabase } from '../../apps/api/src/database.js';
import { readConfig } from '../../apps/api/src/config.js';
import { migrate } from '../../scripts/migrations.js';
import { PgSnapshots } from '../../apps/api/src/bff/repository.js';
import {
  importRowSchema,
  normalizeImport,
} from '../../apps/api/src/bff/normalize.js';
import { manifest } from '../helpers/bff.js';

const config = readConfig();
const database = createDatabase(config);
beforeAll(async () => {
  if (
    process.env.ALLOW_DB_TESTS !== 'true' ||
    !config.DATABASE_URL ||
    new URL(config.DATABASE_URL).pathname !== '/air_quality_geo_research_test'
  )
    throw new Error('Only the confirmed project test database is permitted.');
  await migrate(database.pool!);
});
afterAll(async () => {
  await database.close();
});
it('stores and replays a bounded synthetic snapshot without merging monitors, periods or missing values', async () => {
  const store = new PgSnapshots(database.pool);
  const batch = normalizeImport(manifest());
  const before = await database.pool!.query(
    'SELECT * FROM aq_workbench.foundation',
  );
  const first = await store.save(batch);
  expect(await store.save(batch)).toBe(first);
  const replay = await store.load(first);
  expect(replay).toEqual(batch);
  expect(
    replay.stations.filter(
      (s) =>
        s.identity.nativeSiteId === 'SAMPLE-00001' &&
        s.identity.parameterId === 'PM2.5',
    ),
  ).toHaveLength(2);
  expect(replay.observations.some((o) => o.raw.value === -0.2)).toBe(true);
  expect(replay.observations.some((o) => o.measurement.value === null)).toBe(
    true,
  );
  const listed = await store.list({ mode: 'sample' });
  expect(listed.find((snapshot) => snapshot.id === first)).toMatchObject({
    observationCount: batch.observations.length,
    sourceReference: 'fixture:bff-hourly-v1',
    origin: 'synthetic',
  });
  expect(
    (await database.pool!.query('SELECT * FROM aq_workbench.foundation')).rows,
  ).toEqual(before.rows);
});
it('persists literal SQL-shaped IDs safely and preserves distinct averaging periods', async () => {
  const file = manifest();
  const row = importRowSchema.parse(file.rows[0]);
  row.identity.nativeSiteId = "SAMPLE-00A'); DROP TABLE foundation; --";
  row.name = "SYNTHETIC SAMPLE O'Brien SQL quoting regression";
  file.rows = [
    row,
    {
      ...row,
      period: {
        ...row.period,
        averagingDescription:
          'Distinct synthetic averaging period for SQL regression',
      },
    },
  ];
  file.label = 'SYNTHETIC SAMPLE — SQL quoting and averaging-period regression';
  const store = new PgSnapshots(database.pool);
  const id = await store.save(normalizeImport(file));
  const loaded = await store.load(id);
  expect(loaded.stations[0]!.identity.nativeSiteId).toBe(
    row.identity.nativeSiteId,
  );
  expect(loaded.observations).toHaveLength(2);
  expect(
    (
      await database.pool!.query(
        'SELECT count(*)::integer AS count FROM aq_workbench.foundation',
      )
    ).rows[0].count,
  ).toBe(1);
});
