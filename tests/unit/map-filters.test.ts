import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  bboxSchema,
  GREATER_LA,
  STUDY_REGIONS,
  selectStudyRegion,
} from '@aq/contracts';
import { normalizePollutant } from '../../apps/api/src/bff/pollutants.js';
import {
  importRowSchema,
  normalizeImport,
} from '../../apps/api/src/bff/normalize.js';
import { stationQuerySchema } from '../../apps/api/src/bff/query.js';
import {
  harness,
  manifest,
  modeledBatch,
  TEST_SNAPSHOT_ID,
} from '../helpers/bff.js';

describe('engineering presets and canonical queries', () => {
  it('defines three immutable non-crossing WGS84 rectangles inside the parent study bbox', () => {
    expect(STUDY_REGIONS.map((region) => region.id)).toEqual([
      'greater-la',
      'coastal-la',
      'inland-empire',
    ]);
    for (const region of STUDY_REGIONS) {
      const b = bboxSchema.parse(region.bbox);
      expect(Object.isFrozen(region.bbox)).toBe(true);
      expect(b.west).toBeGreaterThanOrEqual(GREATER_LA.bbox.west);
      expect(b.east).toBeLessThanOrEqual(GREATER_LA.bbox.east);
      expect(b.south).toBeGreaterThanOrEqual(GREATER_LA.bbox.south);
      expect(b.north).toBeLessThanOrEqual(GREATER_LA.bbox.north);
      expect(selectStudyRegion(region.id)).toBe(region);
    }
    expect(() => selectStudyRegion('south-coast-air-basin')).toThrow();
    expect(
      stationQuerySchema.safeParse({
        region: 'coastal-la',
        bbox: '-119,33.5,-117,34.5',
      }).success,
    ).toBe(false);
    expect(
      stationQuerySchema.safeParse({ region: ['coastal-la', 'greater-la'] })
        .success,
    ).toBe(false);
  });
  it('keeps canonical pollutant codes separate from verified AQS parameter strings', () => {
    for (const [code, pollutant] of [
      ['88101', 'PM2.5'],
      ['44201', 'O3'],
      ['81102', 'PM10'],
    ] as const) {
      expect(normalizePollutant(code, 'aqs')).toBe(pollutant);
      expect(normalizePollutant(pollutant, 'domain')).toBe(pollutant);
      expect(normalizePollutant(code, 'domain')).toBeUndefined();
    }
    for (const code of ['PM25', 'ozone', 'world', 88101, null, '__proto__']) {
      expect(normalizePollutant(code, 'aqs')).toBeUndefined();
      expect(stationQuerySchema.safeParse({ pollutant: code }).success).toBe(
        false,
      );
    }
    const file = manifest();
    const base = importRowSchema.parse(file.rows[0]);
    file.dataMode = 'historical';
    file.sourceId = 'epa-aqs';
    file.origin = 'official-historical';
    file.importMethod = 'curated-file';
    file.label = 'TEST DOUBLE ONLY — modeled AQS parameters';
    file.sourceReference =
      'https://aqs.epa.gov/aqsweb/documents/codetables/parameters.html';
    const valid = {
      ...base,
      identity: { ...base.identity, provider: 'aqs', nativeSiteId: '00001' },
      raw: { ...base.raw, parameter: '88101' },
    };
    file.rows = [
      valid,
      { ...valid, raw: { ...valid.raw, parameter: '44201' } },
    ];
    const batch = normalizeImport(file);
    expect(batch.observations).toHaveLength(1);
    expect(batch.observations[0]!.raw.parameter).toBe('88101');
    expect(batch.diagnostics.rejectedRows).toBe(1);
  });
  it('clips presets inclusively after one shared fetch, coalesces concurrent requests and records usage', async () => {
    const sample = { load: vi.fn(async () => modeledBatch()) };
    const h = harness({ sample });
    const results = await Promise.all(
      STUDY_REGIONS.map((region) =>
        h.service.stationReadings({ region: region.id, mode: 'sample' }),
      ),
    );
    expect(results.map((result) => result.data.length)).toEqual([3, 2, 0]);
    for (const [index, result] of results.entries()) {
      expect(result.meta.region).toBe(STUDY_REGIONS[index]!.id);
      expect(result.meta.bbox).toEqual(STUDY_REGIONS[index]!.bbox);
      expect(result.meta.availableCoverage.bbox).toEqual(GREATER_LA.bbox);
    }
    expect(results[2]!.meta.resultState).toBe('empty');
    expect(sample.load).toHaveBeenCalledOnce();
    expect(sample.load).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'greater-la', bbox: GREATER_LA.bbox }),
    );
    await h.service.stationReadings({
      mode: 'sample',
      region: 'coastal-la',
      limit: '1',
    });
    const usage = h.usage.summary();
    expect(usage.cache).toMatchObject({ misses: 1, coalesced: 2, hits: 1 });
    expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
      true,
    );
    const invalid = await request(h.app).get(
      '/api/station-readings?region=coastal-la&bbox=-119,33.5,-117,34.5',
    );
    expect(invalid.status).toBe(400);
  });
  it('retains historical source coverage and shares the identified snapshot across presets', async () => {
    const h = harness();
    h.snapshots.load.mockResolvedValue(modeledBatch('historical'));
    for (const region of STUDY_REGIONS) {
      const result = await h.service.stationReadings({
        region: region.id,
        mode: 'historical',
        snapshotId: TEST_SNAPSHOT_ID,
      });
      expect(result.meta.snapshotId).toBe(TEST_SNAPSHOT_ID);
      expect(result.meta.dataMode).toBe('historical');
    }
    expect(h.snapshots.load).toHaveBeenCalledOnce();
    expect(h.live.load).not.toHaveBeenCalled();
  });
});
