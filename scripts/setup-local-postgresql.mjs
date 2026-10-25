import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = 'air-quality-geo-research-platform-postgresql';
const project = 'air-quality-geo-research-platform';
const localDirectory = new URL('../.local/postgresql/', import.meta.url);
const envFile = new URL('../.env', import.meta.url);
const testEnvFile = new URL('../.env.database-test', import.meta.url);
const docker = (args) =>
  execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const lines = (value) => value.split('\n').filter(Boolean);

class SetupError extends Error {}
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
function updateEnv(source, values) {
  const remaining = new Map(Object.entries(values));
  const output = source.split('\n').map((line) => {
    const key = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/.exec(line)?.[1];
    if (!key || !(key in values)) return line;
    // Replace duplicates as well, preventing an old target overriding the new one.
    remaining.delete(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of remaining) output.push(`${key}=${value}`);
  return `${output.join('\n').trimEnd()}\n`;
}

try {
  docker(['info', '--format', '{{.ServerVersion}}']);
  docker(['compose', 'version', '--short']);
  docker(['image', 'inspect', 'postgres:18.6-bookworm', '--format', '{{.Id}}']);
  if (
    docker(['ps', '-aq', '--filter', `name=^/${name}$`]) ||
    docker([
      'ps',
      '-aq',
      '--filter',
      `label=com.docker.compose.project=${project}`,
    ])
  ) {
    throw new SetupError(
      'A target/project container already exists. Setup refuses to start, replace or alter an existing container.',
    );
  }
  if (
    lines(docker(['volume', 'ls', '--format', '{{.Name}}'])).includes(
      `${name}-data`,
    ) ||
    lines(docker(['network', 'ls', '--format', '{{.Name}}'])).includes(
      `${name}-network`,
    )
  ) {
    throw new SetupError(
      'A target volume/network already exists. Setup refuses to adopt or reset it.',
    );
  }
  const secrets = ['admin-password', 'app-password', 'test-password'];
  if (
    (await exists(testEnvFile)) ||
    (
      await Promise.all(
        secrets.map((file) => exists(new URL(file, localDirectory))),
      )
    ).some(Boolean)
  ) {
    throw new SetupError(
      'Local database credentials already exist. Setup refuses to overwrite or rotate them.',
    );
  }
  const ids = lines(docker(['ps', '-aq']));
  const before = ids.length
    ? lines(
        docker([
          'inspect',
          '--format',
          '{"id":{{json .Id}},"name":{{json .Name}},"status":{{json .State.Status}},"startedAt":{{json .State.StartedAt}},"finishedAt":{{json .State.FinishedAt}},"restarts":{{json .RestartCount}},"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}',
          ...ids,
        ]),
      ).map(JSON.parse)
    : [];
  const reserved = new Set(
    before.flatMap((container) =>
      Object.values(container.ports ?? {}).flatMap((bindings) =>
        (bindings ?? []).map((binding) => Number(binding.HostPort)),
      ),
    ),
  );
  const originalEnv = (await exists(envFile))
    ? await readFile(envFile, 'utf8')
    : await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const requested =
    process.env.POSTGRESQL_PORT ?? parse(originalEnv).POSTGRESQL_PORT;
  let port;
  for (const candidate of requested
    ? [Number(requested)]
    : Array.from({ length: 64 }, (_, i) => 55436 + i)) {
    if (
      Number.isInteger(candidate) &&
      candidate >= 1024 &&
      candidate <= 65535 &&
      !reserved.has(candidate) &&
      (await canBind(candidate))
    ) {
      port = candidate;
      break;
    }
  }
  if (!port)
    throw new SetupError(
      'Requested PostgreSQL port is occupied/reserved or invalid; choose a free POSTGRESQL_PORT.',
    );

  await mkdir(localDirectory, { recursive: true, mode: 0o700 });
  await chmod(new URL('../.local/', import.meta.url), 0o700);
  await chmod(localDirectory, 0o700);
  const passwords = secrets.map(() => randomBytes(32).toString('hex'));
  for (const [index, file] of secrets.entries()) {
    await writeFile(new URL(file, localDirectory), `${passwords[index]}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
  }
  await writeFile(
    new URL('existing-containers.json', localDirectory),
    `${JSON.stringify(before, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  const url = (role, password, database) =>
    `postgresql://${role}:${password}@127.0.0.1:${port}/${database}`;
  await writeFile(
    envFile,
    updateEnv(originalEnv, {
      POSTGRESQL_PORT: String(port),
      DATABASE_URL: url(
        'aq_workbench_app',
        passwords[1],
        'air_quality_geo_research',
      ),
      DB_TARGET_CONFIRMED: project,
    }),
    { mode: 0o600 },
  );
  await chmod(envFile, 0o600);
  await writeFile(
    testEnvFile,
    `DATABASE_URL=${url('aq_workbench_test', passwords[2], 'air_quality_geo_research_test')}\nDB_TARGET_CONFIRMED=${project}\nALLOW_DB_TESTS=true\nALLOW_LIVE_API_TESTS=false\nDATA_MODE=sample\n`,
    { flag: 'wx', mode: 0o600 },
  );

  const result = spawnSync(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '--file',
      'compose.postgresql.yml',
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '60',
      '--pull',
      'never',
      'postgresql',
    ],
    {
      cwd: root,
      env: { ...process.env, POSTGRESQL_PORT: String(port) },
      stdio: 'inherit',
    },
  );
  if (result.status !== 0)
    throw new SetupError(
      'Target startup did not complete. Local credentials/resources were preserved; inspect only this project target.',
    );
  const bootstrap = await readFile(
    new URL('../db/bootstrap/project_databases.sql', import.meta.url),
    'utf8',
  );
  // Hex-generated secrets are sent through stdin and are never printed or put in argv.
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      'postgres',
      name,
      'psql',
      '--no-psqlrc',
      '--username',
      'aq_workbench_admin',
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
    ],
    {
      cwd: root,
      input: `\\set app_password '${passwords[1]}'\n\\set test_password '${passwords[2]}'\n${bootstrap}`,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  console.info(`PostgreSQL target ready: ${name} at 127.0.0.1:${port}`);
  console.info(
    'Development/test credentials saved to ignored mode-600 env files. No passwords printed.',
  );
} catch (error) {
  console.error(
    error instanceof SetupError
      ? error.message
      : 'PostgreSQL setup failed. Check Docker availability and local file permissions; no automatic cleanup or resets are performed.',
  );
  process.exitCode = 1;
}
