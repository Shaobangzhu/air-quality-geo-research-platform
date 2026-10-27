import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { loadEnvironment } from './environment.js';
import { createBff } from './bff/runtime.js';

loadEnvironment();
try {
  const config = readConfig();
  const database = createDatabase(config);
  const bff = createBff(config, database.pool);
  const app = createApp({
    config,
    databaseStatus: () => database.status(),
    bff,
    areas: bff.areas,
    data: bff.data,
  });
  const server = app.listen(config.PORT, config.HOST, () => {
    console.info(
      `Air quality research API listening on ${config.HOST}:${config.PORT}`,
    );
  });
  server.on('error', () => {
    console.error('API listener failed. Check HOST and PORT.');
    process.exitCode = 1;
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 5000).unref();
    server.close(() => {
      void database.close().finally(() => clearTimeout(deadline));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Invalid configuration.',
  );
  process.exitCode = 1;
}
