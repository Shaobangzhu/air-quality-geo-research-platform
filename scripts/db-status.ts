import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createDatabase } from '../apps/api/src/database.js';

loadEnvironment();
try {
  const db = createDatabase(readConfig());
  try {
    const status = await db.status();
    console.info(`Database: ${status}`);
    if (status !== 'connected') process.exitCode = 1;
  } finally {
    await db.close();
  }
} catch {
  console.error(
    'Database configuration rejected. See docs/architecture/database.md.',
  );
  process.exitCode = 1;
}
