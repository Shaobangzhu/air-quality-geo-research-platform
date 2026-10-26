import type { Pool } from 'pg';
import type { Config } from '../config.js';
import { BatchCache } from './cache.js';
import { ProviderHttp } from './http.js';
import { AirNowHourlyAdapter, SampleProvider } from './providers.js';
import { PgSnapshots } from './repository.js';
import { BffService } from './service.js';
import { Usage } from './usage.js';

export function createBff(config: Config, pool?: Pool) {
  const usage = new Usage();
  const http = new ProviderHttp(usage, {
    timeoutMs: config.UPSTREAM_TIMEOUT_MS,
    attempts: config.UPSTREAM_MAX_ATTEMPTS,
    secrets: [
      config.AIRNOW_API_KEY,
      config.AQS_API_KEY,
      config.OPENAI_API_KEY,
    ].filter((key): key is string => !!key),
  });
  return new BffService({
    mode: config.DATA_MODE,
    usage,
    cache: new BatchCache(usage, {
      ttlMs: config.BFF_CACHE_TTL_SECONDS * 1000,
      staleMs: config.BFF_CACHE_STALE_SECONDS * 1000,
    }),
    sample: new SampleProvider(),
    live: new AirNowHourlyAdapter(http, config.AIRNOW_API_KEY),
    snapshots: new PgSnapshots(pool),
    hasAirNowKey: !!config.AIRNOW_API_KEY,
  });
}
