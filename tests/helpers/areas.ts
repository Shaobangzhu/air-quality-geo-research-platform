import { vi } from 'vitest';
import stationFixture from '../../fixtures/synthetic/bff-hourly.json' with { type: 'json' };
import { SampleProvider } from '../../apps/api/src/bff/providers.js';
import fixture from '../../fixtures/synthetic/area-products.json' with { type: 'json' };
import { Usage } from '../../apps/api/src/bff/usage.js';
import {
  SampleAreaProvider,
  AirNowAreaAdapter,
  reportingAreaId,
} from '../../apps/api/src/bff/area-providers.js';
import type { AreaProvider } from '../../apps/api/src/bff/area-providers.js';
import { AreaProductService } from '../../apps/api/src/bff/area-service.js';
import { ProviderHttp } from '../../apps/api/src/bff/http.js';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { harness, TEST_NOW } from './bff.js';
import type { AreaProductId } from '@aq/contracts';
export function areaHarness(
  options: {
    sample?: AreaProvider;
    live?: AreaProvider;
    now?: () => number;
  } = {},
) {
  const now = options.now ?? (() => TEST_NOW);
  const usage = new Usage(now);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('Unexpected external request'));
  const http = new ProviderHttp(usage, {
    fetch: fetcher,
    secrets: ['TEST-AREA-KEY'],
  });
  const sample = options.sample ?? new SampleAreaProvider(fixture);
  const live = options.live ?? new AirNowAreaAdapter(http, 'TEST-AREA-KEY');
  const areas = new AreaProductService({
    sample,
    live,
    usage,
    now,
    defaultMode: 'sample',
  });
  const station = harness({
    usage,
    sample: new SampleProvider(stationFixture),
  });
  const app = createApp({
    config: readConfig({ DATA_MODE: 'sample' }),
    databaseStatus: async () => 'not-configured',
    bff: station.service,
    areas,
  });
  return { app, areas, sample, live, usage, fetcher, http, station };
}
export async function modeledAreaBatch(product: AreaProductId) {
  const batch = await new SampleAreaProvider(fixture).load({
    product,
    region: 'greater-la',
    pollutant: 'PM2.5',
    areaCode: undefined,
  });
  batch.dataMode = 'live';
  batch.scope = 'reviewed-regional-area-code';
  batch.source = {
    provider: 'airnow',
    origin: 'provider-live',
    reference: 'https://docs.airnowapi.org/webservices',
    label:
      'TEST DOUBLE ONLY — modeled area provenance, not acquired official data',
  };
  batch.records = batch.records.map((row) => {
    const code = row.area.code === 'SAMPLE-AREA-001' ? '0001A' : '0002B';
    return {
      ...row,
      area: {
        ...row.area,
        code,
        provider: 'airnow',
        id: reportingAreaId('airnow', code),
      },
    };
  });
  return batch;
}
