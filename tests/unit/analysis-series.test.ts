import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  analysisSeriesResponseSchema,
  hourlyTimeline,
  observationInterpretation,
} from '@aq/contracts';
import {
  harness,
  manifest,
  modeledBatch,
  TEST_SNAPSHOT_ID,
} from '../helpers/bff.js';
import {
  importRowSchema,
  normalizeImport,
} from '../../apps/api/src/bff/normalize.js';
import { BffError } from '../../apps/api/src/bff/errors.js';

describe('bounded environmental analysis series', () => {
  it.each([24, 48, 72])(
    'returns %i UTC slots with original sparse values, explicit nulls and coverage gaps',
    async (hours) => {
      const sample = { load: vi.fn(async () => modeledBatch()) };
      const h = harness({ sample });
      const discovery = await h.service.stations({ mode: 'sample' });
      const ids = discovery.data.map((row) => row.id);
      const result = await h.service.analysis({
        mode: 'sample',
        windowHours: String(hours),
        stationIds: ids.join(','),
      });
      expect(result.series).toHaveLength(3);
      expect(result.windowHours).toBe(hours);
      for (const series of result.series) {
        expect(series.slots).toHaveLength(hours);
        expect(
          series.summary!.availableCount +
            series.summary!.missingCount +
            series.summary!.conflictCount,
        ).toBe(hours);
        expect(series.summary!.outsideCoverageCount).toBe(hours - 24);
        expect(
          series.records.every(
            (row) => row.measurement.kind === 'concentration',
          ),
        ).toBe(true);
        for (const slot of series.slots.filter(
          (slot) => slot.state === 'observed',
        ))
          expect(slot.observationIds).toHaveLength(1);
      }
      const alpha = result.series.find(
        (row) =>
          row.station.identity.monitorId === '00A' &&
          row.station.identity.nativeSiteId === 'SAMPLE-00001',
      )!;
      expect(alpha.records.some((row) => row.measurement.value === 0)).toBe(
        true,
      );
      expect(alpha.records.some((row) => row.measurement.value === -0.2)).toBe(
        true,
      );
      expect(alpha.summary).toMatchObject({
        availableCount: 4,
        nullCount: 0,
        min: -0.2,
        max: 15.5,
      });
      const missing = result.series.find(
        (row) => row.station.identity.monitorId === '00B',
      )!;
      expect(missing.summary).toMatchObject({
        availableCount: 3,
        nullCount: 1,
      });
      expect(
        missing.slots.find(
          (slot) => Date.parse(slot.at) === Date.parse('2026-01-15T18:00:00Z'),
        )!.state,
      ).toBe('null');
      expect(result.acquisition.origin).toBe('synthetic');
      expect(result.primaryId).toBe(ids[0]);
      await h.service.analysis({
        mode: 'sample',
        windowHours: String(hours),
        stationIds: ids.slice(0, 1).join(','),
      });
      expect(sample.load).toHaveBeenCalledTimes(hours === 24 ? 1 : 2); // 24h map discovery, then one bounded window load
      expect(
        h.usage.summary().providers.every((row) => row.requests === 0),
      ).toBe(true);
    },
  );
  it('keeps AQI as an independent product and rejects unbounded/duplicate/unsupported selections', async () => {
    const h = harness();
    const result = await h.service.analysis({ measurementType: 'aqi' });
    expect(result.series[0]!.interpretation!.unit).toBe('AQI');
    expect(
      result.series[0]!.records.every((row) => row.measurement.kind === 'aqi'),
    ).toBe(true);
    const ids = (await h.service.stations({})).data.map((row) => row.id);
    for (const query of [
      'windowHours=168',
      'windowHours=30',
      'stationIds=bad',
      'limit=500',
      'windowHours=24&windowHours=72',
      `stationIds=${ids[0]},${ids[0]}`,
      `stationIds=${[...ids, 's_' + 'a'.repeat(32)].join(',')}`,
    ])
      expect(
        (await request(h.app).get(`/api/analysis-series?${query}`)).status,
      ).toBe(400);
    const missing = 's_' + 'a'.repeat(32);
    const absent = await h.service.analysis({ stationIds: missing });
    expect(absent.primaryId).toBe(missing);
    expect(absent.missingStationIds).toEqual([missing]);
    expect(absent.series).toEqual([]);
    expect(
      absent.candidates.every((row) => row.reason === 'primary-unavailable'),
    ).toBe(true);
  });
  it('blocks inconsistent units, unknown/mixed averaging and incompatible comparison without converting', async () => {
    const file = manifest();
    const base = importRowSchema.parse(
      file.rows.find((raw) => {
        const row = importRowSchema.parse(raw);
        return (
          row.measurement.pollutant === 'O3' &&
          row.measurement.kind === 'concentration'
        );
      }),
    );
    const row = (
      monitorId: string,
      unit: 'ppb' | 'ppm',
      description = base.period.averagingDescription,
    ) => ({
      ...base,
      identity: { ...base.identity, monitorId },
      measurement: { ...base.measurement, unit },
      period: { ...base.period, averagingDescription: description },
    });
    file.rows = [
      row('A', 'ppb'),
      row('B', 'ppm'),
      row('C', 'ppb', 'Different hourly interpretation'),
      { ...row('D', 'ppb'), period: { ...base.period, meaning: 'unknown' } },
      row('E', 'ppb'),
      {
        ...row('E', 'ppm'),
        observedAt: '2026-01-15T18:00:00Z',
        period: {
          ...base.period,
          startsAt: '2026-01-15T18:00:00Z',
          endsAt: '2026-01-15T19:00:00Z',
        },
      },
    ];
    const batch = normalizeImport(file);
    const h = harness({ sample: { load: async () => batch } });
    const a = batch.stations.find(
      (station) => station.identity.monitorId === 'A',
    )!.id;
    const result = await h.service.analysis({ pollutant: 'O3', stationIds: a });
    expect(
      result.candidates.find((item) => item.station.identity.monitorId === 'B')!
        .reason,
    ).toBe('unit-mismatch');
    expect(
      result.candidates.find((item) => item.station.identity.monitorId === 'C')!
        .reason,
    ).toBe('averaging-mismatch');
    expect(
      result.candidates.find((item) => item.station.identity.monitorId === 'D')!
        .reason,
    ).toBe('averaging-unverified');
    expect(
      result.candidates.find((item) => item.station.identity.monitorId === 'E')!
        .reason,
    ).toBe('units-inconsistent');
    const b = batch.stations.find(
      (station) => station.identity.monitorId === 'B',
    )!.id;
    const selected = await h.service.analysis({
      pollutant: 'O3',
      stationIds: [a, b].join(','),
    });
    expect(selected.series[1]).toMatchObject({
      reason: 'unit-mismatch',
      slots: [],
      summary: null,
    });
    expect(selected.series[1]!.records[0]!.measurement.unit).toBe('ppm');
  });
  it('retains conflicting revisions as an unplotted gap and never picks or averages one', async () => {
    const file = manifest();
    const base = importRowSchema.parse(file.rows[0]);
    file.rows = [
      base,
      { ...base, measurement: { ...base.measurement, value: 12 } },
    ];
    const h = harness({ sample: { load: async () => normalizeImport(file) } });
    const result = await h.service.analysis({});
    expect(result.series[0]!.summary).toMatchObject({
      conflictCount: 1,
      availableCount: 0,
      min: null,
      max: null,
      peakAt: null,
    });
    expect(
      result.series[0]!.slots.find((slot) => slot.state === 'conflict')!
        .observationIds,
    ).toHaveLength(2);
    expect(result.series[0]!.records).toHaveLength(2);
    const bad = structuredClone(result);
    bad.series[0]!.slots.find((slot) => slot.state === 'conflict')!.state =
      'observed';
    expect(analysisSeriesResponseSchema.safeParse(bad).success).toBe(false);
  });
  it('preserves interval start/end meaning, rejects off-grid/unknown intervals and validates summaries', async () => {
    const batch = modeledBatch();
    const row = batch.observations[0]!;
    expect(observationInterpretation(row)?.alignment).toBe('interval-start');
    expect(
      observationInterpretation({ ...row, observedAt: row.period.endsAt! })
        ?.alignment,
    ).toBe('interval-end');
    expect(
      observationInterpretation({ ...row, observedAt: '2026-01-15T17:30:00Z' }),
    ).toBeNull();
    expect(
      observationInterpretation({
        ...row,
        period: { ...row.period, startsAt: null },
      }),
    ).toBeNull();
    expect(
      observationInterpretation({
        ...row,
        period: { ...row.period, meaning: 'nowcast' },
      }),
    ).toBeNull();
    const result = await harness().service.analysis({});
    const bad = structuredClone(result);
    bad.series[0]!.summary!.availableCount = 99;
    expect(analysisSeriesResponseSchema.safeParse(bad).success).toBe(false);
    const boundary = structuredClone(result);
    boundary.meta.window.from = '2026-01-14T21:30:00Z';
    expect(analysisSeriesResponseSchema.safeParse(boundary).success).toBe(
      false,
    );
  });
  it('reads historical partial coverage from one identified snapshot; rejects synthetic history and unavailable live', async () => {
    const h = harness();
    h.snapshots.load.mockResolvedValue(modeledBatch('historical'));
    const result = await h.service.analysis({
      mode: 'historical',
      snapshotId: TEST_SNAPSHOT_ID,
      windowHours: '72',
    });
    expect(result.meta.snapshotId).toBe(TEST_SNAPSHOT_ID);
    expect(result.series[0]!.summary!.outsideCoverageCount).toBe(48);
    expect(result.acquisition.origin).toBe('official-historical');
    expect(h.snapshots.load).toHaveBeenCalledOnce();
    expect(h.live.load).not.toHaveBeenCalled();
    const other = harness();
    other.snapshots.load.mockResolvedValue(modeledBatch());
    await expect(
      other.service.analysis({
        mode: 'historical',
        snapshotId: TEST_SNAPSHOT_ID,
      }),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_MODE_MISMATCH' });
    await expect(h.service.analysis({ mode: 'live' })).rejects.toMatchObject({
      code: 'PROVIDER_CONTRACT_UNVERIFIED',
    });
    const failure = harness({
      live: {
        load: async () => {
          throw new BffError('UPSTREAM_TIMEOUT');
        },
      },
    });
    await expect(
      failure.service.analysis({ mode: 'live' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(
      (await request(h.app).get('/api/analysis-series?mode=historical')).status,
    ).toBe(400);
  });
});

it('creates distinct UTC instants through both Los Angeles DST transitions without duplicate/reinvented slots', () => {
  const labels = (from: string) =>
    hourlyTimeline(from, 6).map((at) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        timeZoneName: 'short',
      }).format(new Date(at)),
    );
  const spring = labels('2026-03-08T08:00:00Z');
  expect(spring).not.toContain('2 AM PST');
  expect(spring).toContain('3 AM PDT');
  const fall = labels('2026-11-01T07:00:00Z');
  expect(fall).toContain('1 AM PDT');
  expect(fall).toContain('1 AM PST');
  expect(new Set(hourlyTimeline('2026-11-01T07:00:00Z', 24)).size).toBe(24);
  expect(() => hourlyTimeline('2026-01-01T00:30:00Z', 24)).toThrow();
  expect(() => hourlyTimeline('2026-01-01T00:00:00Z', 73)).toThrow();
});

it('omits a peak when equal maxima or conflicting revisions make it ambiguous', async () => {
  const file = manifest();
  const base = importRowSchema.parse(file.rows[0]);
  const next = {
    ...base,
    observedAt: '2026-01-15T18:00:00Z',
    period: {
      ...base.period,
      startsAt: '2026-01-15T18:00:00Z',
      endsAt: '2026-01-15T19:00:00Z',
    },
  };
  file.rows = [base, next];
  const tied = await harness({
    sample: { load: async () => normalizeImport(file) },
  }).service.analysis({});
  expect(tied.series[0]!.summary).toMatchObject({
    availableCount: 2,
    min: 0,
    max: 0,
    peakAt: null,
  });
  file.rows = [
    base,
    { ...base, measurement: { ...base.measurement, value: 12 } },
    next,
  ];
  const conflict = await harness({
    sample: { load: async () => normalizeImport(file) },
  }).service.analysis({});
  expect(conflict.series[0]!.summary).toMatchObject({
    availableCount: 1,
    conflictCount: 1,
    peakAt: null,
  });
});
