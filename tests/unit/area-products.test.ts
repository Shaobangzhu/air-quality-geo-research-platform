import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import {
  areaBatchSchema,
  areaProductsResponseSchema,
  productsResponseSchema,
} from '@aq/contracts';
import fixture from '../../fixtures/synthetic/area-products.json' with { type: 'json' };
import { areaHarness, modeledAreaBatch } from '../helpers/areas.js';
import {
  AirNowAreaAdapter,
  SampleAreaProvider,
  AREA_ALLOWED_PATHS,
  reportingAreaId,
  validateAreaBatch,
} from '../../apps/api/src/bff/area-providers.js';
import type {
  AreaProviderQuery,
  AreaWireContract,
} from '../../apps/api/src/bff/area-providers.js';
import { Usage } from '../../apps/api/src/bff/usage.js';
import { ProviderHttp } from '../../apps/api/src/bff/http.js';
const query: AreaProviderQuery = {
  product: 'reporting-area-aqi',
  region: 'greater-la',
  pollutant: 'PM2.5',
  areaCode: '0001A',
};

describe('separate reporting-area application products', () => {
  it('serves labeled synthetic aggregates, missing AQI and date-only/category-only predictions without station fields', async () => {
    const h = areaHarness();
    const current = areaProductsResponseSchema.parse(
      (await request(h.app).get('/api/reporting-area-aqi?mode=sample')).body,
    );
    expect(current.data).toHaveLength(2);
    expect(current.meta.source.origin).toBe('synthetic');
    expect(
      current.data.every(
        (row) =>
          row.product === 'reporting-area-current-aqi' &&
          row.area.geometry === null,
      ),
    ).toBe(true);
    expect(
      current.data.some((row) => row.aqi === null && row.category === null),
    ).toBe(true);
    const forecast = areaProductsResponseSchema.parse(
      (await request(h.app).get('/api/forecasts?mode=sample')).body,
    );
    expect(forecast.data).toHaveLength(2);
    const first = forecast.data[0]!;
    expect(first).toMatchObject({
      product: 'reporting-area-forecast',
      issuedAt: null,
      aqi: null,
      category: 'Moderate',
      validity: { precision: 'date', date: '2026-01-16', sourceTimeZone: null },
    });
    for (const row of [...current.data, ...forecast.data]) {
      expect(row).not.toHaveProperty('stationId');
      expect(row).not.toHaveProperty('concentration');
    }
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(
      h.usage.summary().providers.every((provider) => provider.requests === 0),
    ).toBe(true);
    const catalog = productsResponseSchema.parse(
      (await request(h.app).get('/api/data-products')).body,
    );
    expect(catalog.data.map((row) => row.id)).toEqual([
      'monitoring-stations',
      'reporting-area-aqi',
      'forecast',
    ]);
  });
  it('keeps area codes opaque and rejects category mismatches, mixed products, source leakage and invented geometry', async () => {
    const batch = await new SampleAreaProvider(fixture).load({
      ...query,
      areaCode: undefined,
    });
    const invalid = (change: (value: typeof batch) => void) => {
      const copy = structuredClone(batch);
      change(copy);
      return areaBatchSchema.safeParse(copy).success;
    };
    expect(
      invalid((value) => {
        value.records[0]!.category = 'Good';
      }),
    ).toBe(false);
    expect(
      invalid((value) => {
        Object.assign(value.records[0]!, { concentration: 12 });
      }),
    ).toBe(false);
    expect(
      invalid((value) => {
        Object.assign(value.records[0]!.area, {
          geometry: { longitude: -118, latitude: 34 },
        });
      }),
    ).toBe(false);
    expect(
      invalid((value) => {
        Object.assign(value.records[0]!, {
          product: 'reporting-area-forecast',
        });
      }),
    ).toBe(false);
    expect(
      invalid((value) => {
        delete (value.records[0] as Partial<(typeof value.records)[number]>)
          .reportingAgency;
      }),
    ).toBe(false);
    expect(
      invalid((value) => {
        value.source.reference =
          'https://docs.airnowapi.org/webservices?key=SECRET';
      }),
    ).toBe(false);
    expect(reportingAreaId('airnow', '0001A')).not.toBe(
      reportingAreaId('airnow', '1A'),
    );
    expect(reportingAreaId('airnow', '0001A')).not.toBe(
      reportingAreaId('synthetic', '0001A'),
    );
    const bad = structuredClone(batch);
    bad.records[0]!.area.id = 'ra_' + 'a'.repeat(32);
    expect(() => validateAreaBatch(bad)).toThrow();
  });
  it('validates forecast issuance/windows without turning date-only forecasts into hourly observations', async () => {
    const batch = await new SampleAreaProvider(fixture).load({
      ...query,
      product: 'forecast',
    });
    expect(batch.records[0]).not.toHaveProperty('observedAt');
    const row = batch.records[0]!;
    if (row.product !== 'reporting-area-forecast')
      throw new Error('Wrong fixture product');
    row.issuedAt = '2026-01-16T00:00:00Z';
    expect(areaBatchSchema.safeParse(batch).success).toBe(false);
    row.issuedAt = null;
    row.validity = {
      precision: 'instant-window',
      from: '2026-01-17T01:00:00Z',
      to: '2026-01-16T01:00:00Z',
      sourceTimeZone: 'UTC',
    };
    expect(areaBatchSchema.safeParse(batch).success).toBe(false);
  });
  it('validates bounded queries and returns empty/missing area products rather than inventing coverage', async () => {
    const h = areaHarness();
    for (const path of [
      'region=world',
      'limit=21',
      'offset=40',
      'zipCode=90001',
      'api_key=DO_NOT_REFLECT',
      'mode=sample&mode=live',
      'areaCode=',
      'pollutant=NO2',
      'bbox=-180,-90,180,90',
    ]) {
      const response = await request(h.app).get(
        '/api/reporting-area-aqi?' + path,
      );
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toContain('DO_NOT_REFLECT');
    }
    for (const params of [
      { pollutant: 'PM10' },
      { region: 'coastal-la' },
      { areaCode: 'SAMPLE-ABSENT' },
    ]) {
      const result = await h.areas.read('reporting-area-aqi', params);
      expect(result.data).toEqual([]);
      expect(result.meta.resultState).toBe('empty');
    }
    const missingTime = await h.areas.read('reporting-area-aqi', {
      pollutant: 'O3',
    });
    expect(missingTime.data[0]).toMatchObject({ observedAt: null, aqi: 38 });
    expect(
      (await request(h.app).get('/api/forecasts?mode=historical')).body.error
        .code,
    ).toBe('PRODUCT_HISTORY_UNAVAILABLE');
    expect(
      (await request(h.app).get('/api/reporting-area-aqi?mode=live')).body.error
        .code,
    ).toBe('PROVIDER_CONTRACT_UNVERIFIED');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('coalesces/cache-isolates products, filters pagination after acquisition, and expires forecasts/observations at separate TTLs', async () => {
    let now = Date.parse('2026-01-15T22:00:00Z');
    const provider = new SampleAreaProvider(fixture);
    const sample = { load: vi.fn((q: AreaProviderQuery) => provider.load(q)) };
    const h = areaHarness({ sample, now: () => now });
    const results = await Promise.all([
      h.areas.read('reporting-area-aqi', { limit: '1' }),
      h.areas.read('reporting-area-aqi', { areaCode: 'SAMPLE-AREA-001' }),
    ]);
    expect(sample.load).toHaveBeenCalledOnce();
    expect(results[1]!.meta.cache.status).toBe('coalesced');
    results[0]!.data[0]!.aqi = 999;
    expect((await h.areas.read('reporting-area-aqi', {})).data[0]!.aqi).toBe(
      62,
    );
    await h.areas.read('forecast', {});
    expect(sample.load).toHaveBeenCalledTimes(2);
    now += 301_000;
    await h.areas.read('reporting-area-aqi', {});
    await h.areas.read('forecast', {});
    expect(sample.load).toHaveBeenCalledTimes(3);
    now += 1_500_000;
    await h.areas.read('forecast', {});
    expect(sample.load).toHaveBeenCalledTimes(4);
    expect(h.usage.summary().cache).toMatchObject({
      misses: 4,
      coalesced: 1,
      hits: 2,
    });
  });
});

describe('unregistered AirNow area wire boundary (mock transport only)', () => {
  it('never calls transport with a missing key/codec, or with a legacy/cross-product destination', async () => {
    const usage = new Usage();
    const fetcher = vi.fn<typeof fetch>();
    const http = new ProviderHttp(usage, { fetch: fetcher });
    await expect(new AirNowAreaAdapter(http).load(query)).rejects.toMatchObject(
      { code: 'PROVIDER_NOT_CONFIGURED' },
    );
    await expect(
      new AirNowAreaAdapter(http, 'TEST-KEY').load(query),
    ).rejects.toMatchObject({ code: 'PROVIDER_CONTRACT_UNVERIFIED' });
    for (const path of [
      '/aq/observation/zipCode/current/',
      '/aq/forecast/zipCode/',
      '/aq/forecast/latLong/',
      '/aq/observation/latLong/current/',
      '/aq/observation/zipCode/historical/',
      '/aq/observation/latLong/historical/',
      '/aq/forecast/current/',
    ]) {
      const codec: AreaWireContract = {
        evidence: 'TEST DOUBLE ONLY',
        buildRequest: () => new URL('https://www.airnowapi.org' + path),
        decode: (value) => value,
      };
      await expect(
        new AirNowAreaAdapter(http, 'TEST-KEY', codec).load(query),
      ).rejects.toMatchObject({ code: 'PROVIDER_CONTRACT_UNVERIFIED' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates a deliberately synthetic wire envelope, preserves leading-zero area identity, and rejects malformed/foreign records', async () => {
    const batch = await modeledAreaBatch('reporting-area-aqi');
    batch.records = batch.records.filter((row) => row.area.code === '0001A');
    const usage = new Usage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ mockAreaFixture: batch })),
      );
    const http = new ProviderHttp(usage, {
      fetch: fetcher,
      attempts: 1,
      secrets: ['TEST-KEY'],
    });
    const codec: AreaWireContract = {
      evidence: 'TEST DOUBLE ONLY — not an official payload',
      buildRequest: (q, key) => {
        const url = new URL(
          'https://www.airnowapi.org' + AREA_ALLOWED_PATHS[q.product],
        );
        url.searchParams.set('mock_test_key', key);
        return url;
      },
      decode: (value) =>
        z.strictObject({ mockAreaFixture: z.unknown() }).parse(value)
          .mockAreaFixture,
    };
    const adapter = new AirNowAreaAdapter(http, 'TEST-KEY', codec);
    const result = await adapter.load(query);
    expect(result.records[0]!.area.code).toBe('0001A');
    expect(usage.summary().providers[0]!.requests).toBe(1);
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          mockAreaFixture: {
            ...batch,
            records: [{ ...batch.records[0], category: 'Hazardous' }],
          },
        }),
      ),
    );
    await expect(adapter.load(query)).rejects.toMatchObject({
      code: 'UPSTREAM_MALFORMED',
    });
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ mockAreaFixture: batch })),
    );
    await expect(
      adapter.load({ ...query, areaCode: '0002B' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_MALFORMED' });
  });
  it.each([429, 504])('isolates HTTP %i without fallback', async (status) => {
    const usage = new Usage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status }));
    const http = new ProviderHttp(usage, { fetch: fetcher, attempts: 1 });
    const codec: AreaWireContract = {
      evidence: 'TEST ONLY',
      buildRequest: () =>
        new URL('https://www.airnowapi.org' + AREA_ALLOWED_PATHS.forecast),
      decode: (value) => value,
    };
    await expect(
      new AirNowAreaAdapter(http, 'TEST-KEY', codec).load({
        ...query,
        product: 'forecast',
      }),
    ).rejects.toMatchObject({
      code: status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_SERVER_ERROR',
    });
  });
});

it('bounds a hanging mock request and accepts an empty typed product without synthesizing records', async () => {
  const batch = await modeledAreaBatch('forecast');
  batch.records = [];
  const usage = new Usage();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ mockAreaFixture: batch })),
    )
    .mockImplementation(() => new Promise(() => {}));
  const http = new ProviderHttp(usage, {
    fetch: fetcher,
    attempts: 1,
    timeoutMs: 20,
  });
  const codec: AreaWireContract = {
    evidence: 'TEST ONLY',
    buildRequest: () =>
      new URL('https://www.airnowapi.org' + AREA_ALLOWED_PATHS.forecast),
    decode: (value) =>
      z.strictObject({ mockAreaFixture: z.unknown() }).parse(value)
        .mockAreaFixture,
  };
  const adapter = new AirNowAreaAdapter(http, 'TEST-KEY', codec);
  expect(
    (await adapter.load({ ...query, product: 'forecast' })).records,
  ).toEqual([]);
  await expect(
    adapter.load({ ...query, product: 'forecast' }),
  ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
});

it('does not retain expired data on refresh failure or attribute fixture calls to provider traffic', async () => {
  let now = 0;
  const provider = new SampleAreaProvider(fixture);
  const sample = { load: vi.fn((q: AreaProviderQuery) => provider.load(q)) };
  const h = areaHarness({ sample, now: () => now });
  await h.areas.read('forecast', {});
  now = 1_800_001;
  sample.load.mockRejectedValueOnce(new Error('TEST failure'));
  await expect(h.areas.read('forecast', {})).rejects.toThrow('TEST failure');
  expect(h.usage.summary().cache.staleResponses).toBe(0);
  expect(h.usage.summary().providers.every((row) => row.requests === 0)).toBe(
    true,
  );
});
it('redacts reflected credentials at the mock adapter boundary and leaves startup free of requests', async () => {
  const h = areaHarness();
  expect(h.fetcher).not.toHaveBeenCalled();
  const batch = await modeledAreaBatch('forecast');
  batch.source.label = 'TEST-KEY';
  batch.records = batch.records.filter((row) => row.area.code === '0001A');
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(batch)));
  const http = new ProviderHttp(new Usage(), { fetch: fetcher, attempts: 1 });
  const adapter = new AirNowAreaAdapter(http, 'TEST-KEY', {
    evidence: 'TEST ONLY',
    buildRequest: () =>
      new URL('https://www.airnowapi.org' + AREA_ALLOWED_PATHS.forecast),
    decode: (value) => value,
  });
  try {
    await adapter.load({ ...query, product: 'forecast' });
    throw new Error('Expected decoder rejection');
  } catch (error) {
    expect(error).toMatchObject({ code: 'UPSTREAM_MALFORMED' });
    expect((error as Error).message).not.toContain('TEST-KEY');
  }
});
