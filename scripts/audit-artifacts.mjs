// Compare configured secret values without printing them. The inventory comes
// from this build's output, avoiding unrelated stale files in a local dist folder.
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'dotenv';

if (
  process.argv.length !== 6 ||
  process.argv[2] !== '--build-log' ||
  process.argv[4] !== '--source-list'
) {
  console.error(
    'Usage: node scripts/audit-artifacts.mjs --build-log <npm-build-output.log> --source-list <git-ls-files-null-delimited>',
  );
  process.exit(1);
}
const values = new Map();
for (const file of ['.env', '.env.database-test']) {
  if (!existsSync(file)) continue;
  const env = parse(readFileSync(file));
  for (const name of [
    'AIRNOW_API_KEY',
    'AQS_API_KEY',
    'AQS_EMAIL',
    'OPENAI_API_KEY',
    'DATABASE_URL',
  ]) {
    if (env[name]) values.set(`${file}:${name}`, env[name]);
  }
  if (env.DATABASE_URL) {
    try {
      const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
      if (password.length >= 8)
        values.set(`${file}:database-password`, password);
    } catch {
      /* Never expose invalid input. */
    }
  }
}
const assets = [
  ...new Set(
    [
      ...readFileSync(process.argv[3], 'utf8').matchAll(
        /^dist\/(\S+\.(?:js|css|html))\s/gm,
      ),
    ].map((m) => `apps/web/dist/${m[1]}`),
  ),
];
if (assets.length < 100)
  throw new Error(
    'Current Vite build inventory missing. Capture full npm run build output.',
  );
const sourceFiles = readFileSync(process.argv[5], 'utf8')
  .split('\0')
  .filter((p) =>
    /\.(?:[cm]?[jt]sx?|json|ya?ml|md|sql|html|css|example)$/.test(p),
  );
const hits = [];
for (const file of [...new Set([...assets, ...sourceFiles])]) {
  const content = readFileSync(file, 'utf8');
  for (const [name, value] of values)
    if (content.includes(value)) hits.push({ file, field: name });
}
console.log(
  JSON.stringify(
    {
      currentBuildAssets: assets.length,
      sourceFiles: sourceFiles.length,
      configuredSecretFieldsChecked: values.size,
      secretHits: hits,
      publicArcgisTokenExcluded: true,
      scope:
        'Configured server values in current client assets and tracked/nonignored text; not a full security certification.',
    },
    null,
    2,
  ),
);
if (hits.length) process.exitCode = 1;
