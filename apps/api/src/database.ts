import pg from 'pg';
import type { DatabaseStatus } from '@aq/contracts';
import type { Config } from './config.js';

export function createDatabase(config: Config) {
  // Creating a Pool does not connect. Connections only happen on explicit probes/migrations.
  const pool = config.DATABASE_URL
    ? new pg.Pool({
        connectionString: config.DATABASE_URL,
        max: 3,
        connectionTimeoutMillis: 1500,
        idleTimeoutMillis: 5000,
        query_timeout: 2000,
        statement_timeout: 2000,
        application_name: 'air-quality-geo-research-platform',
      })
    : undefined;
  // A lost idle connection must not crash the local service or log secrets.
  pool?.on('error', () => {});
  return {
    pool,
    async status(): Promise<DatabaseStatus> {
      if (!pool) return 'not-configured';
      try {
        await pool.query('SELECT 1');
        return 'connected';
      } catch {
        return 'unavailable';
      }
    },
    async close() {
      await pool?.end();
    },
  };
}
