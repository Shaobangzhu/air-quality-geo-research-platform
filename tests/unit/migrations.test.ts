import type { Pool } from 'pg';
import { expect, it, vi } from 'vitest';
import { migrate } from '../../scripts/migrations.js';

it('refuses to adopt an existing unmarked schema and rolls back', async () => {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes('FROM pg_namespace') ? [{ owner: null }] : [],
  }));
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
  await expect(migrate(pool)).rejects.toThrow('ownership marker');
  expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
  expect(
    query.mock.calls.some(([sql]) => sql.startsWith('CREATE SCHEMA')),
  ).toBe(false);
  expect(release).toHaveBeenCalledOnce();
});
