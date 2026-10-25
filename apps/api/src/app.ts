import express from 'express';
import type { DatabaseStatus } from '@aq/contracts';
import { healthSchema } from '@aq/contracts';
import type { Config } from './config.js';

export function createApp(options: {
  config: Pick<Config, 'DATA_MODE'>;
  databaseStatus: () => Promise<DatabaseStatus>;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', async (_req, res) => {
    let database: DatabaseStatus;
    try {
      database = await options.databaseStatus();
    } catch {
      database = 'unavailable';
    }
    res.set('Cache-Control', 'no-store').json(
      healthSchema.parse({
        service: 'aq-research-api',
        status: 'ok',
        database,
        data: {
          mode: options.config.DATA_MODE,
          state: 'unavailable',
          reason: 'foundation-only',
        },
      }),
    );
  });
  app.use((_req, res) => {
    res.status(404).json({ error: 'not-found' });
  });
  return app;
}
