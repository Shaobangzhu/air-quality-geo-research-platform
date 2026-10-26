import { describe, expect, it } from 'vitest';
import { batchSchema, GREATER_LA } from '@aq/contracts';
import {
  importRowSchema,
  normalizeImport,
  stationId,
} from '../../apps/api/src/bff/normalize.js';
import { stationQuerySchema } from '../../apps/api/src/bff/query.js';
import { manifest } from '../helpers/bff.js';

describe('BFF scientific identities and values', () => {
  it('preserves string IDs, co-located monitors and parameter identities', () => {
    const batch = normalizeImport(manifest());
    const colocated = batch.stations.filter(
      (site) =>
        site.identity.nativeSiteId === 'SAMPLE-00001' &&
        site.identity.parameterId === 'PM2.5',
    );
    expect(colocated).toHaveLength(2);
    expect(colocated[0]!.coordinate).toEqual(colocated[1]!.coordinate);
    expect(colocated[0]!.id).not.toBe(colocated[1]!.id);
    const identity = {
      provider: 'airnow' as const,
      nativeSiteId: '0000A001',
      monitorId: '00B',
      parameterId: 'PM25',
    };
    expect(stationId(identity)).toBe(stationId({ ...identity }));
    expect(stationId(identity)).not.toBe(
      stationId({ ...identity, monitorId: '00C' }),
    );
    expect(stationId(identity)).not.toBe(
      stationId({ ...identity, parameterId: null }),
    );
  });
  it('keeps negative/zero/missing measurements and AQI units distinct', () => {
    const batch = normalizeImport(manifest());
    expect(
      batch.observations.some(
        (o) => o.measurement.value === -0.2 && o.raw.value === -0.2,
      ),
    ).toBe(true);
    expect(batch.observations.some((o) => o.measurement.value === 0)).toBe(
      true,
    );
    expect(batch.observations.some((o) => o.measurement.value === null)).toBe(
      true,
    );
    expect(
      batch.observations
        .filter((o) => o.measurement.kind === 'aqi')
        .every((o) => o.measurement.unit === 'AQI'),
    ).toBe(true);
    expect(batch.resultState).toBe('partial');
    expect(batch.observations[0]!.provenance.transportProvider).toBe(
      'synthetic',
    );
    expect(batch.observations[0]!.provenance.sourceAgency).toBe(
      'Fictional Research Test Agency',
    );
  });
  it('retains different averaging periods and conflicting revisions without overwriting', () => {
    const file = manifest();
    const row = importRowSchema.parse(file.rows[0]);
    file.rows = [
      row,
      row,
      {
        ...row,
        period: {
          ...row.period,
          averagingDescription: 'Another explicitly distinct averaging product',
        },
      },
      { ...row, measurement: { ...row.measurement, value: 4 } },
    ];
    const batch = normalizeImport(file);
    expect(batch.observations).toHaveLength(3);
    expect(batch.diagnostics.duplicateRows).toBe(1);
    expect(batch.diagnostics.conflictingRows).toBe(1);
    expect(batch.resultState).toBe('partial');
  });
  it('rejects malformed rows with safe diagnostics while preserving usable data', () => {
    const file = manifest();
    file.rows.push(
      { unknown: 'do not persist this raw object' },
      {
        ...importRowSchema.parse(file.rows[0]),
        coordinate: { longitude: 181, latitude: 34 },
      },
    );
    const batch = normalizeImport(file);
    expect(batch.diagnostics.rejectedRows).toBe(2);
    expect(batch.diagnostics.rejectedRowIndexes).toHaveLength(2);
    expect(JSON.stringify(batch)).not.toContain('do not persist');
    expect(batchSchema.safeParse(batch).success).toBe(true);
    expect(() =>
      normalizeImport({ ...file, rows: [{ invalid: true }] }),
    ).toThrow();
  });
  it('treats a valid empty result separately from a malformed response', () => {
    expect(normalizeImport({ ...manifest(), rows: [] }).resultState).toBe(
      'empty',
    );
    expect(() => normalizeImport({})).toThrow();
  });
  it('rejects sample relabeling, authenticated references and reflected secrets', () => {
    const file = manifest();
    expect(() =>
      normalizeImport({
        ...file,
        dataMode: 'historical',
        origin: 'official-historical',
      }),
    ).toThrow();
    expect(() =>
      normalizeImport({
        ...file,
        sourceReference:
          'https://docs.airnowapi.org/webservices?API_KEY=secret',
      }),
    ).toThrow();
    expect(() =>
      normalizeImport({ ...file, label: 'SYNTHETIC SAMPLE TOP_SECRET' }, [
        'TOP_SECRET',
      ]),
    ).toThrow();
    const row = importRowSchema.parse(file.rows[0]);
    expect(() =>
      normalizeImport({
        ...file,
        rows: [{ ...row, raw: { ...row.raw, qualifier: '?token=private' } }],
      }),
    ).toThrow();
  });
});
describe('bounded input contracts', () => {
  it.each([
    { mode: 'fallback' },
    { mode: ['sample', 'live'] },
    { region: 'world' },
    { bbox: '-180,-90,180,90' },
    { bbox: '-118,34,-119,33' },
    { bbox: '-118,,0,34' },
    { windowHours: '73' },
    { limit: '501' },
    { offset: '2000' },
    { endAt: '2026-02-30T00:00:00Z' },
    { endAt: '2026-01-15T00:30:00Z' },
    { endAt: '2026-01-15T00:00:00-08:00' },
    { apiKey: 'secret' },
    { endAt: '0001-01-01T00:00:00Z' },
    { endAt: '9999-01-01T00:00:00Z' },
  ])('rejects unsupported query %j', (query) => {
    expect(stationQuerySchema.safeParse(query).success).toBe(false);
  });
  it('canonicalizes equivalent UTC instants and validates a sub-bbox', () => {
    expect(
      stationQuerySchema.parse({ endAt: '2026-01-15T21:00:00Z' }).endAt,
    ).toBe(
      stationQuerySchema.parse({ endAt: '2026-01-15T21:00:00.000Z' }).endAt,
    );
    expect(
      stationQuerySchema.parse({
        bbox: `${GREATER_LA.bbox.west},${GREATER_LA.bbox.south},${GREATER_LA.bbox.east},${GREATER_LA.bbox.north}`,
      }).bbox,
    ).toEqual(GREATER_LA.bbox);
  });
});
