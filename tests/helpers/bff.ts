import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { BatchCache } from '../../apps/api/src/bff/cache.js';
import { BffError } from '../../apps/api/src/bff/errors.js';
import {
  importManifestSchema,
  importRowSchema,
  normalizeImport,
} from '../../apps/api/src/bff/normalize.js';
import { SampleProvider } from '../../apps/api/src/bff/providers.js';
import type { StationProvider } from '../../apps/api/src/bff/providers.js';
import { BffService } from '../../apps/api/src/bff/service.js';
import { Usage } from '../../apps/api/src/bff/usage.js';
import type { SnapshotStore } from '../../apps/api/src/bff/repository.js';

export const TEST_SNAPSHOT_ID = '00000000-0000-4000-8000-000000000002';
export const TEST_NOW = Date.parse('2026-01-15T22:00:00Z');
export function manifest() {
  return importManifestSchema.parse(
    JSON.parse(
      readFileSync(
        new URL('../../fixtures/synthetic/bff-hourly.json', import.meta.url),
        'utf8',
      ),
    ),
  );
}
export function modeledBatch(
  mode: 'sample' | 'live' | 'historical' = 'sample',
) {
  const file = manifest();
  if (mode !== 'sample') {
    // Test double only: these records were never acquired from AirNow/AQS.
    file.dataMode = mode;
    file.sourceId = 'airnow-hourly';
    file.origin = mode === 'live' ? 'provider-live' : 'official-historical';
    file.importMethod = mode === 'live' ? 'live-fetch' : 'curated-file';
    file.label =
      'TEST DOUBLE ONLY — modeled provenance; not an acquired official dataset';
    file.sourceReference = 'https://docs.airnowapi.org/webservices';
    file.rows = file.rows.map((raw) => {
      const row = importRowSchema.parse(raw);
      row.identity.provider = 'airnow';
      row.identity.nativeSiteId = `0000A${row.identity.nativeSiteId.replace('SAMPLE-', '')}`;
      row.dataStatus = 'preliminary';
      return row;
    });
  }
  return normalizeImport(file);
}
export function harness(
  options: {
    live?: StationProvider;
    sample?: StationProvider;
    now?: () => number;
    ttlMs?: number;
    staleMs?: number;
    usage?: Usage;
  } = {},
) {
  const now = options.now ?? (() => TEST_NOW);
  const usage = options.usage ?? new Usage(now);
  const snapshots = {
    save: vi.fn(async () => TEST_SNAPSHOT_ID),
    load: vi
      .fn<SnapshotStore['load']>()
      .mockRejectedValue(new BffError('SNAPSHOT_NOT_FOUND', 404)),
    list: vi.fn(async () => []),
  };
  const live = options.live ?? {
    load: vi.fn(async () => {
      throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
    }),
  };
  const sample = options.sample ?? new SampleProvider();
  const service = new BffService({
    mode: 'sample',
    sample,
    live,
    snapshots,
    usage,
    now,
    cache: new BatchCache(usage, {
      ttlMs: options.ttlMs ?? 300_000,
      staleMs: options.staleMs ?? 900_000,
      now,
    }),
    hasAirNowKey: true,
  });
  const app = createApp({
    config: readConfig({ DATA_MODE: 'sample' }),
    databaseStatus: async () => 'connected',
    bff: service,
  });
  return { app, service, snapshots, live, sample, usage };
}
