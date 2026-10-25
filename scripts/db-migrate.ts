import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createDatabase } from '../apps/api/src/database.js';
import { migrate } from './migrations.js';

loadEnvironment();
try {
  const db = createDatabase(readConfig());
  try {
    if (!db.pool) throw new Error('No target configured.');
    const applied = await migrate(db.pool);
    console.info(
      applied.length
        ? `Applied migrations: ${applied.join(', ')}`
        : 'Migrations already current.',
    );
  } finally {
    await db.close();
  }
} catch {
  // Do not print driver errors: they can contain connection strings or credentials.
  console.error(
    'Migration failed or target not configured. Check isolated target, ownership, permissions and migration checksums. See docs/architecture/database.md.',
  );
  process.exitCode = 1;
}
