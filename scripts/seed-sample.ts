import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createDatabase } from '../apps/api/src/database.js';
import { SampleProvider } from '../apps/api/src/bff/providers.js';
import { PgSnapshots } from '../apps/api/src/bff/repository.js';

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
  // The same deterministic, validated fixture used by the keyless UI.
  // Content-addressed saves return the existing snapshot without rewriting it.
  const batch = await new SampleProvider().load();
  const db = createDatabase(config);
  try {
    console.info(
      `Synthetic sample seeded: ${await new PgSnapshots(db.pool).save(batch)}; ${batch.observations.length} observations; fixture:bff-hourly-v1. Not official historical data.`,
    );
  } finally {
    await db.close();
  }
} catch {
  console.error(
    'Sample seed failed. Check explicit project target, migrations and the synthetic fixture. No reset is performed.',
  );
  process.exitCode = 1;
}
