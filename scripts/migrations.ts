import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

const migrationDirectory = new URL('../db/migrations/', import.meta.url);
export async function migrate(pool: Pool): Promise<string[]> {
  const names = (await readdir(migrationDirectory))
    .filter((n) => /^\d{3}_[a-z_]+\.sql$/.test(n))
    .sort();
  const migrations = await Promise.all(
    names.map(async (name) => {
      const sql = await readFile(new URL(name, migrationDirectory), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Transaction lock serializes this project's migration runner only.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [241025, 1001]);
    const existing = await client.query<{ owner: string | null }>(
      "SELECT obj_description(oid, 'pg_namespace') AS owner FROM pg_namespace WHERE nspname = $1",
      ['aq_workbench'],
    );
    if (
      existing.rows.length &&
      existing.rows[0]?.owner !== 'air-quality-geo-research-platform'
    ) {
      throw new Error(
        'Schema ownership marker missing; refusing to adopt existing schema.',
      );
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS aq_workbench');
    await client.query(
      "COMMENT ON SCHEMA aq_workbench IS 'air-quality-geo-research-platform'",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS aq_workbench.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM aq_workbench.schema_migrations ORDER BY name',
    );
    for (const row of applied.rows) {
      const migration = migrations.find((m) => m.name === row.name);
      if (!migration || migration.checksum !== row.checksum)
        throw new Error('Migration history differs from source.');
    }
    const pending = migrations.filter(
      (m) => !applied.rows.some((row) => row.name === m.name),
    );
    const latest = applied.rows.at(-1)?.name;
    if (latest && pending.some((m) => m.name < latest))
      throw new Error('Refusing out-of-order migration.');
    for (const migration of pending) {
      // SQL is trusted, version-controlled migration source, not user input.
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO aq_workbench.schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum],
      );
    }
    await client.query('COMMIT');
    return pending.map((m) => m.name);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
