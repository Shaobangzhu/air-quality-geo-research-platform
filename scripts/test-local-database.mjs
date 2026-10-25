import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

try {
  const target = parse(
    await readFile(new URL('../.env.database-test', import.meta.url), 'utf8'),
  );
  const result = spawnSync('npm', ['run', 'test:db'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, ...target },
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} catch {
  console.error(
    'Local test database configuration is unavailable. Provision the isolated target with npm run db:setup first.',
  );
  process.exitCode = 1;
}
