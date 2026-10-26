import type { Pool } from 'pg';
import { expect, it, vi } from 'vitest';
import { PgSnapshots } from '../../apps/api/src/bff/repository.js';
import { modeledBatch } from '../helpers/bff.js';

it('refuses a full store transaction without pruning or inserting data', async () => {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes('AS snapshots')
      ? [{ snapshots: 32, sites: 0, new_sites: 9 }]
      : [],
  }));
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
  await expect(
    new PgSnapshots(pool).save(modeledBatch()),
  ).rejects.toMatchObject({ code: 'STORAGE_LIMIT' });
  const sql = query.mock.calls.map(([query]) => query).join('\n');
  expect(sql).toContain('ROLLBACK');
  expect(sql).not.toMatch(/\b(?:INSERT|DELETE|DROP|TRUNCATE)\b/i);
  expect(release).toHaveBeenCalledOnce();
});
it('uses a bind parameter for a snapshot identifier and redacts driver failures', async () => {
  const query = vi
    .fn()
    .mockRejectedValue(new Error('postgresql://secret-driver-message'));
  const store = new PgSnapshots({ query } as unknown as Pool);
  const dangerous =
    "00000000-0000-4000-8000-000000000002'; DROP TABLE foundation; --";
  const promise = store.load(dangerous);
  await expect(promise).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
  await expect(promise).rejects.not.toThrow('secret-driver-message');
  expect(query.mock.calls[0]![0]).not.toContain(dangerous);
  expect(query.mock.calls[0]![1]).toEqual([dangerous]);
});
