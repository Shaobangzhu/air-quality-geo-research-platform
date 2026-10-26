import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { GREATER_LA, stationReadingsResponseSchema } from '@aq/contracts';
import {
  importRowSchema,
  normalizeImport,
} from '../../apps/api/src/bff/normalize.js';
import { BffError } from '../../apps/api/src/bff/errors.js';
import {
  harness,
  manifest,
  modeledBatch,
  TEST_NOW,
  TEST_SNAPSHOT_ID,
} from '../helpers/bff.js';

describe('bounded map station readings', () => {
  it.each(['PM2.5', 'O3', 'PM10'])(
    'returns actual latest supplied %s records with one cached batch and no upstream attempt',
    async (pollutant) => {
      const sample = { load: vi.fn(async () => modeledBatch()) };
      const h = harness({ sample });
      const response = await request(h.app).get(
        `/api/station-readings?mode=sample&pollutant=${pollutant}`,
      );
      expect(response.status).toBe(200);
      const result = stationReadingsResponseSchema.parse(response.body);
      expect(result.data).toHaveLength(3);
      expect(
        new Set(
          result.data.map(
            (item) =>
              `${item.station.coordinate.longitude},${item.station.coordinate.latitude}`,
          ),
        ).size,
      ).toBe(2);
      for (const item of result.data) {
        expect(item.station.identity.nativeSiteId).toMatch(/^SAMPLE-/);
        expect(item.observations).toHaveLength(2);
        expect(
          item.observations.every(
            (row) =>
              row.measurement.pollutant === pollutant &&
              row.observedAt === '2026-01-15T20:00:00Z',
          ),
        ).toBe(true);
      }
      await h.service.stations({ mode: 'sample', pollutant });
      await h.service.stationReadings({ mode: 'sample', pollutant });
      expect(sample.load).toHaveBeenCalledOnce();
      expect(h.live.load).not.toHaveBeenCalled();
      expect(h.snapshots.save).not.toHaveBeenCalled();
      expect(
        h.usage
          .summary()
          .providers.every((provider) => provider.requests === 0),
      ).toBe(true);
    },
  );
  it('keeps latest null, true zero, small negative source values, and diagnoses blank AQI/invalid geography', async () => {
    const file = manifest();
    const base = importRowSchema.parse(file.rows[0]);
    const aqi = importRowSchema.parse(file.rows[1]);
    file.rows = [
      base,
      aqi,
      {
        ...base,
        observedAt: '2026-01-15T20:00:00Z',
        measurement: { ...base.measurement, value: null },
        raw: { ...base.raw, value: null },
      },
      {
        ...aqi,
        observedAt: '2026-01-15T20:00:00Z',
        measurement: { ...aqi.measurement, value: 0 },
        raw: { ...aqi.raw, value: 0 },
      },
      { ...aqi, measurement: { ...aqi.measurement, value: '' } },
      { ...base, coordinate: { longitude: 181, latitude: 34 } },
      { ...base, coordinate: { longitude: -120, latitude: 34 } },
    ];
    const batch = normalizeImport(file);
    const h = harness({ sample: { load: async () => batch } });
    const result = await h.service.stationReadings({ mode: 'sample' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.station.identity.nativeSiteId).toBe('SAMPLE-00001');
    expect(result.data[0]!.station.identity.monitorId).toBe('00A');
    expect(
      result.data[0]!.observations.map((row) => row.measurement.value),
    ).toEqual(expect.arrayContaining([null, 0]));
    expect(result.meta.diagnostics.rejectedRows).toBe(3);
    const negative = {
      ...base,
      measurement: { ...base.measurement, value: -0.2 },
      raw: { ...base.raw, value: -0.2 },
    };
    expect(
      normalizeImport({ ...file, rows: [negative] }).observations[0]!
        .measurement.value,
    ).toBe(-0.2);
  });
  it('retains co-located identities, distinct periods and conflicting latest revisions without arbitrary selection', async () => {
    const file = manifest();
    const base = importRowSchema.parse(file.rows[0]);
    const other = {
      ...base,
      identity: { ...base.identity, monitorId: '00B' },
      name: 'SYNTHETIC SAMPLE co-located monitor',
    };
    file.rows = [
      base,
      base,
      other,
      { ...base, measurement: { ...base.measurement, value: 12 } },
      {
        ...base,
        period: {
          ...base.period,
          meaning: 'unknown',
          averagingDescription: 'A distinct unknown averaging period',
        },
      },
    ];
    const h = harness({ sample: { load: async () => normalizeImport(file) } });
    const result = await h.service.stationReadings({ mode: 'sample' });
    expect(result.data).toHaveLength(2);
    expect(
      result.data.find((item) => item.station.identity.monitorId === '00A')!
        .observations,
    ).toHaveLength(3);
    expect(result.meta.diagnostics).toMatchObject({
      duplicateRows: 1,
      conflictingRows: 1,
    });
  });
  it('clips by source coordinates, honors pagination/window, and reports empty rather than failure', async () => {
    const h = harness();
    const result = await h.service.stationReadings({
      mode: 'sample',
      bbox: '-118.3,34,-118.2,34.1',
      limit: '1',
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.pagination).toMatchObject({ total: 2, nextOffset: 1 });
    const empty = await h.service.stationReadings({
      mode: 'sample',
      endAt: '2026-01-14T21:00:00Z',
    });
    expect(empty.data).toEqual([]);
    expect(empty.meta.resultState).toBe('empty');
    expect(
      (await request(h.app).get('/api/station-readings?bbox=-180,-90,180,90'))
        .status,
    ).toBe(400);
    const invalid = structuredClone(result);
    invalid.data[0]!.station.coordinate.longitude = GREATER_LA.bbox.west - 1;
    expect(stationReadingsResponseSchema.safeParse(invalid).success).toBe(
      false,
    );
  });
  it('reads only stored historical provenance and preserves source statuses; refuses sample-as-history', async () => {
    const h = harness();
    h.snapshots.load.mockResolvedValue(modeledBatch('historical'));
    const response = await request(h.app).get(
      `/api/station-readings?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
    );
    expect(response.status).toBe(200);
    const result = stationReadingsResponseSchema.parse(response.body);
    expect(result.meta.dataMode).toBe('historical');
    expect(result.data[0]!.observations[0]!.dataStatus).toBe('preliminary');
    expect(h.live.load).not.toHaveBeenCalled();
    const other = harness();
    other.snapshots.load.mockResolvedValue(modeledBatch());
    expect(
      (
        await request(other.app).get(
          `/api/station-readings?mode=historical&snapshotId=${TEST_SNAPSHOT_ID}`,
        )
      ).status,
    ).toBe(409);
    expect(
      (await request(other.app).get('/api/station-readings?mode=live')).body
        .error.code,
    ).toBe('PROVIDER_CONTRACT_UNVERIFIED');
  });
  it('returns same-mode stale values without resetting observation/fetch times on provider failure', async () => {
    let now = TEST_NOW;
    const live = { load: vi.fn(async () => modeledBatch('live')) };
    const h = harness({ live, now: () => now, ttlMs: 1000, staleMs: 60000 });
    const first = await h.service.stationReadings({ mode: 'live' });
    live.load.mockRejectedValue(new BffError('UPSTREAM_NETWORK', 502));
    now += 2000;
    const stale = await h.service.stationReadings({ mode: 'live' });
    expect(stale.meta.cache.status).toBe('stale');
    expect(stale.data).toEqual(first.data);
    expect(stale.meta.fetchedAt).toBe(first.meta.fetchedAt);
    expect(stale.meta.dataMode).toBe('live');
  });
});
