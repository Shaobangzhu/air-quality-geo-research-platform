import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  datasetsResponseSchema,
  errorEnvelopeSchema,
  observationsResponseSchema,
  regionsResponseSchema,
  stationsResponseSchema,
  usageSummarySchema,
} from '@aq/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { AirNowHourlyAdapter } from '../../apps/api/src/bff/providers.js';
import { ProviderHttp } from '../../apps/api/src/bff/http.js';
import { createBff } from '../../apps/api/src/bff/runtime.js';
import { Usage } from '../../apps/api/src/bff/usage.js';
import { BffError } from '../../apps/api/src/bff/errors.js';
import {
  harness,
  modeledBatch,
  TEST_NOW,
  TEST_SNAPSHOT_ID,
} from '../helpers/bff.js';

describe('read-only normalized API', () => {
  it('serves typed catalogs, sample stations and process-scoped usage without provider or DB calls', async () => {
    const h = harness();
    const regions = await request(h.app).get('/api/regions');
    expect(regionsResponseSchema.parse(regions.body).data[0]!.crs).toBe(
      'EPSG:4326',
    );
    expect(
      (await request(h.app).get('/api/data-products')).body.data[0]
        .maxWindowHours,
    ).toBe(72);
    const response = await request(h.app).get(
      '/api/stations?mode=sample&pollutant=PM2.5',
    );
    const stations = stationsResponseSchema.parse(response.body);
    expect(response.status).toBe(200);
    expect(stations.data).toHaveLength(3);
    expect(stations.meta).toMatchObject({
      dataMode: 'sample',
      resultState: 'partial',
      snapshotId: null,
      cache: { status: 'miss' },
      delayed: null,
    });
    expect(
      stations.data.some((s) => s.identity.nativeSiteId === 'SAMPLE-00B02'),
    ).toBe(true);
    const usage = usageSummarySchema.parse(
      (await request(h.app).get('/api/usage/summary')).body,
    );
    expect(usage.startedAt).toBe(new Date(TEST_NOW).toISOString());
    expect(
      usage.providers.every(
        (p) => p.requests === 0 && p.cacheHits === 0 && p.cacheMisses === 0,
      ),
    ).toBe(true);
    expect(h.snapshots.save).not.toHaveBeenCalled();
    expect(h.snapshots.load).not.toHaveBeenCalled();
    expect((await request(h.app).get('/api/health')).body.data.state).toBe(
      'available',
    );
  });
  it('returns measurement units, nulls, zeroes, negatives and original agency separately from transport', async () => {
    const h = harness();
    const list = stationsResponseSchema.parse(
      (await request(h.app).get('/api/stations')).body,
    );
    for (const station of list.data) {
      const response = observationsResponseSchema.parse(
        (await request(h.app).get(`/api/stations/${station.id}/observations`))
          .body,
      );
      expect(response.data.station.identity.nativeSiteId).toBe(
        station.identity.nativeSiteId,
      );
      expect(
        response.data.observations.every(
          (o) =>
            o.measurement.kind === 'concentration' &&
            o.measurement.unit === 'µg/m³',
        ),
      ).toBe(true);
      if (station.identity.monitorId === '00B')
        expect(
          response.data.observations.some((o) => o.measurement.value === null),
        ).toBe(true);
      if (
        station.identity.nativeSiteId === 'SAMPLE-00001' &&
        station.identity.monitorId === '00A'
      ) {
        expect(
          response.data.observations.some((o) => o.measurement.value === 0),
        ).toBe(true);
        expect(
          response.data.observations.some((o) => o.raw.value === -0.2),
        ).toBe(true);
      }
      if (station.identity.nativeSiteId === 'SAMPLE-00B02')
        expect(
          response.data.observations.map((o) => o.observedAt),
        ).not.toContain('2026-01-15T19:00:00Z');
      expect(response.data.observations[0]!.provenance).toMatchObject({
        sourceAgency: 'Fictional Research Test Agency',
        transportProvider: 'synthetic',
        origin: 'synthetic',
      });
    }
  });
  it('paginates after a single fetch and isolates pollutant, time, kind and mode cache keys', async () => {
    const sample = { load: vi.fn(async () => modeledBatch()) };
    const h = harness({ sample });
    const first = await h.service.stations({ limit: '2' });
    const second = await h.service.stations({
      offset: '2',
      limit: '2',
      endAt: '2026-01-15T21:00:00.000Z',
    });
    expect(first.meta.pagination.nextOffset).toBe(2);
    expect(second.data).toHaveLength(1);
    expect(sample.load).toHaveBeenCalledOnce();
    await h.service.stations({ bbox: '-118.5,34,-118,34.2' });
    expect(sample.load).toHaveBeenCalledOnce();
    await h.service.stations({ pollutant: 'O3' });
    await h.service.stations({ measurementType: 'aqi' });
    await h.service.stations({ windowHours: '12' });
    await h.service.stations({ endAt: '2026-01-15T20:00:00Z' });
    expect(sample.load).toHaveBeenCalledTimes(5);
    await expect(h.service.stations({ mode: 'live' })).rejects.toMatchObject({
      code: 'PROVIDER_CONTRACT_UNVERIFIED',
    });
    expect(sample.load).toHaveBeenCalledTimes(5);
  });
  it.each([
    '/api/stations?bbox=-180,-90,180,90',
    '/api/stations?mode=live&mode=sample',
    '/api/stations?endAt=2026-02-30T00:00:00Z',
    '/api/stations?limit=501',
    '/api/stations?mode=sample&snapshotId=00000000-0000-4000-8000-000000000002',
    '/api/stations/invalid-native-id/observations',
    '/api/regions?key=DO_NOT_REFLECT',
    '/api/usage/summary?apiKey=DO_NOT_REFLECT',
    '/api/stations?region=DO_NOT_REFLECT',
  ])('validates inputs without reflection: %s', async (url) => {
    const h = harness();
    const response = await request(h.app).get(url);
    expect(response.status).toBe(400);
    expect(errorEnvelopeSchema.parse(response.body).error.code).toBe(
      'INVALID_REQUEST',
    );
    expect(response.text).not.toContain('DO_NOT_REFLECT');
  });
  it('distinguishes empty windows from unsupported live/historical data', async () => {
    const h = harness();
    expect(
      (await request(h.app).get('/api/stations?endAt=2026-01-17T21:00:00Z'))
        .body.meta.resultState,
    ).toBe('empty');
    expect(
      (await request(h.app).get('/api/stations?mode=historical')).body.error
        .code,
    ).toBe('SNAPSHOT_REQUIRED');
    expect(
      (
        await request(h.app).get(
          `/api/stations?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
        )
      ).status,
    ).toBe(404);
    h.snapshots.load.mockResolvedValueOnce(modeledBatch());
    expect(
      (
        await request(h.app).get(
          `/api/stations?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
        )
      ).body.error.code,
    ).toBe('SNAPSHOT_MODE_MISMATCH');
  });
  it('reads historical data only from the identified local snapshot with its original status', async () => {
    const h = harness();
    h.snapshots.load.mockResolvedValue(modeledBatch('historical'));
    const response = await request(h.app).get(
      `/api/stations?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({
      dataMode: 'historical',
      snapshotId: TEST_SNAPSHOT_ID,
    });
    const id = response.body.data[0].id;
    const observations = await request(h.app).get(
      `/api/stations/${id}/observations?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
    );
    expect(observations.body.data.observations[0]).toMatchObject({
      dataStatus: 'preliminary',
      provenance: { origin: 'official-historical' },
    });
    expect(h.snapshots.load).toHaveBeenCalledOnce();
    await expect(
      h.service.stations({
        mode: 'historical',
        snapshotId: TEST_SNAPSHOT_ID,
        windowHours: '72',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_RANGE' });
    expect(
      h.usage
        .summary()
        .providers.every((p) => p.requests === 0 && p.cacheHits === 0),
    ).toBe(true);
  });
  it('reports unavailable dataset storage while retaining truthful static source metadata', async () => {
    const h = harness();
    h.snapshots.list.mockRejectedValue(new Error('postgres://DO_NOT_EXPOSE'));
    const response = await request(h.app).get('/api/datasets');
    expect(datasetsResponseSchema.parse(response.body)).toMatchObject({
      database: 'unavailable',
      resultState: 'partial',
      warning: 'DATABASE_UNAVAILABLE',
    });
    expect(response.text).not.toContain('DO_NOT_EXPOSE');
    expect(
      response.body.sources.find(
        (s: { id: string }) => s.id === 'airnow-hourly',
      ).verification,
    ).toContain('unverified');
  });
  it('does not expose a configured key or silently enable an unverified live contract', async () => {
    const config = readConfig({ AIRNOW_API_KEY: 'TOP_SECRET' });
    const bff = createBff(config);
    const app = createApp({
      config,
      databaseStatus: async () => 'not-configured',
      bff,
    });
    const response = await request(app).get('/api/stations?mode=live');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('PROVIDER_CONTRACT_UNVERIFIED');
    expect(response.text).not.toContain('TOP_SECRET');
    expect(bff.usage().providers[0]!.requests).toBe(0);
    const noKey = createBff(readConfig({}));
    await expect(noKey.stations({ mode: 'live' })).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  });
});

describe('live-shaped test codec and exact cache/attempt accounting (HTTP mocked)', () => {
  function adapter(fetcher: typeof fetch, usage: Usage) {
    return new AirNowHourlyAdapter(
      new ProviderHttp(usage, {
        fetch: fetcher,
        sleep: async () => {},
        secrets: ['TOP_SECRET'],
      }),
      'TOP_SECRET',
      {
        evidence:
          'TEST ONLY synthetic codec; not an official AirNow wire specification',
        buildRequest: () => new URL('https://www.airnowapi.org/aq/data/'),
        decode: (input) => input,
      },
    );
  }
  it('coalesces 20 callers, counts one retry, and records a subsequent hit without another HTTP request', async () => {
    const usage = new Usage(() => TEST_NOW);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(modeledBatch('live'))),
      );
    const h = harness({ live: adapter(fetcher, usage), usage });
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => h.service.stations({ mode: 'live' })),
    );
    expect(responses.every((r) => r.meta.dataMode === 'live')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(usage.summary().providers[0]).toMatchObject({
      requests: 2,
      successes: 1,
      failures: 1,
    });
    await h.service.stations({ mode: 'live' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(h.usage.summary().providers[0]).toMatchObject({
      requests: 2,
      successes: 1,
      failures: 1,
      cacheMisses: 1,
      cacheHits: 1,
      coalescedRequests: 19,
    });
    expect(h.snapshots.save).toHaveBeenCalledOnce();
  });
  it('returns stale live data after failed revalidation and never calls the sample provider', async () => {
    let time = TEST_NOW;
    const provider = {
      load: vi
        .fn()
        .mockResolvedValueOnce(modeledBatch('live'))
        .mockRejectedValue(new BffError('UPSTREAM_SERVER_ERROR', 502, true)),
    };
    const sample = { load: vi.fn(async () => modeledBatch()) };
    const h = harness({
      live: provider,
      sample,
      now: () => time,
      ttlMs: 10,
      staleMs: 20,
    });
    const first = await h.service.stations({ mode: 'live' });
    time += 11;
    const stale = await h.service.stations({ mode: 'live' });
    expect(stale.meta.cache).toMatchObject({
      status: 'stale',
      staleReason: 'UPSTREAM_SERVER_ERROR',
    });
    expect(stale.meta.fetchedAt).toBe(first.meta.fetchedAt);
    expect(stale.meta.warnings).toContain('stale-data');
    expect(stale.meta.dataMode).toBe('live');
    time += 20;
    await expect(h.service.stations({ mode: 'live' })).rejects.toMatchObject({
      code: 'UPSTREAM_SERVER_ERROR',
    });
    expect(sample.load).not.toHaveBeenCalled();
  });
  it('reports delayed observations and failed persistence without changing provenance', async () => {
    const old = modeledBatch('live');
    old.observations = old.observations.filter(
      (o) => Date.parse(o.observedAt) < Date.parse('2026-01-15T19:00:00Z'),
    );
    const h = harness({ live: { load: async () => old } });
    h.snapshots.save.mockRejectedValue(new BffError('STORAGE_LIMIT', 409));
    const response = await h.service.stations({ mode: 'live' });
    expect(response.meta.delayed).toBe(true);
    expect(response.meta.warnings).toEqual(
      expect.arrayContaining([
        'snapshot-not-persisted',
        'delayed-observations',
      ]),
    );
    expect(response.meta.snapshotId).toBeNull();
    expect(response.meta.persistenceError).toBe('STORAGE_LIMIT');
    expect(response.meta.dataMode).toBe('live');
  });
});
