import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createDatabase } from '../apps/api/src/database.js';
import { loadWildfireCase } from '../apps/api/src/wildfire/case.js';
import { seedHistoricalCase } from '../apps/api/src/wildfire/seed.js';
loadEnvironment();
try {
  const config = readConfig();
  if (
    process.argv.length !== 4 ||
    process.argv[2] !== '--target' ||
    !['air_quality_geo_research', 'air_quality_geo_research_test'].includes(
      process.argv[3]!,
    ) ||
    !config.DATABASE_URL ||
    new URL(config.DATABASE_URL).pathname !== `/${process.argv[3]}`
  )
    throw new Error('Explicit confirmed target required.');
  const data = loadWildfireCase();
  const db = createDatabase(config);
  try {
    if (!db.pool) throw new Error('Database unavailable.');
    console.info(
      `Historical case seeded: ${await seedHistoricalCase(db.pool, data)}; ${data.batch.observations.length} EPA rows; source manifest fixtures/historical/eaton-fire-2025/manifest.json`,
    );
  } finally {
    await db.close();
  }
} catch {
  console.error(
    'Historical case seed failed. Check explicit project target, migrations, immutable manifest and asset checksums.',
  );
  process.exitCode = 1;
}
