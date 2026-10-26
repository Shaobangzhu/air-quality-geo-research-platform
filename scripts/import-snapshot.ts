import { readFile, stat } from 'node:fs/promises';
import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createDatabase } from '../apps/api/src/database.js';
import { normalizeImport } from '../apps/api/src/bff/normalize.js';
import { PgSnapshots } from '../apps/api/src/bff/repository.js';
import { BffError } from '../apps/api/src/bff/errors.js';

loadEnvironment();
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--file')
    throw new BffError('INVALID_REQUEST', 400);
  const file = process.argv[3]!;
  if ((await stat(file)).size > 2_000_000)
    throw new BffError('UPSTREAM_TOO_LARGE', 400);
  const config = readConfig();
  const secrets = [
    config.AIRNOW_API_KEY,
    config.AQS_API_KEY,
    config.OPENAI_API_KEY,
  ].filter((key): key is string => !!key);
  const batch = normalizeImport(
    JSON.parse(await readFile(file, 'utf8')),
    secrets,
  );
  // Live capture is an adapter operation, never a local file relabeling shortcut.
  if (batch.dataMode === 'live') throw new BffError('INVALID_REQUEST', 400);
  const database = createDatabase(config);
  try {
    console.info(
      `Snapshot imported: ${await new PgSnapshots(database.pool).save(batch)} (${batch.dataMode}; ${batch.observations.length} observations)`,
    );
  } finally {
    await database.close();
  }
} catch (error) {
  console.error(
    error instanceof BffError
      ? `${error.code}: ${error.message}`
      : 'Snapshot import failed. Check the bounded import format and isolated database configuration.',
  );
  process.exitCode = 1;
}
