import { expect, it } from 'vitest';
import request from 'supertest';
import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  wildfireCaseSchema,
  wildfireManifestSchema,
  caseGeometrySchema,
} from '@aq/contracts';
import { loadWildfireCase } from '../../apps/api/src/wildfire/case.js';
import { createApp } from '../../apps/api/src/app.js';
const data = loadWildfireCase();
it('ties the official Eaton identity, release versions and study coverage to checksummed assets', () => {
  expect(data.manifest.event).toMatchObject({
    started: '2025-01-07',
    contained: '2025-01-31',
    incidentId: '00009087',
  });
  expect(data.manifest.sources.find((s) => s.id === 'perimeter')).toMatchObject(
    { version: 'firep25_1', released: '2026-04' },
  );
  expect(data.manifest.sources.find((s) => s.id === 'sra')?.effective).toBe(
    '2024-04-01',
  );
  expect(
    data.manifest.sources.find((s) => s.id === 'lra')?.effective,
  ).toBeNull();
  expect(data.batch.stations[0]?.identity).toEqual({
    provider: 'aqs',
    nativeSiteId: '06-037-1103',
    monitorId: '3',
    parameterId: '88101',
  });
  expect(data.batch.observations).toHaveLength(71);
  expect(data.batch.diagnostics.rejectedRows).toBe(0);
  expect(new Set(data.batch.observations.map((r) => r.raw.qualifier))).toEqual(
    new Set([null, 'IT', 'IJ']),
  );
  expect(
    data.batch.observations.every(
      (r) =>
        r.dataMode === 'historical' &&
        r.dataStatus === 'unknown' &&
        r.period.meaning === 'hourly',
    ),
  ).toBe(true);
  expect(
    data.batch.observations.some((r) =>
      r.period.averagingDescription.includes('2026-03-26'),
    ),
  ).toBe(true);
  expect(data.layers).toHaveLength(51);
  expect(data.layers.filter((f) => f.layer === 'sra')).toHaveLength(31);
  expect(
    new Set(
      data.layers.filter((f) => f.layer === 'lra').map((f) => f.category),
    ),
  ).toEqual(new Set(['Moderate', 'High', 'Very High']));
});
it('rejects case relabeling, missing official records, unsafe sources and fabricated local adoption', () => {
  expect(
    wildfireCaseSchema.safeParse({
      ...data,
      batch: { ...data.batch, dataMode: 'sample' },
    }).success,
  ).toBe(false);
  expect(
    wildfireCaseSchema.safeParse({
      ...data,
      batch: { ...data.batch, observations: [] },
    }).success,
  ).toBe(false);
  expect(
    wildfireManifestSchema.safeParse({
      ...data.manifest,
      event: { ...data.manifest.event, started: '2024-01-07' },
    }).success,
  ).toBe(false);
  for (const update of [
    { originalUrl: 'https://aqs.epa.gov/file?key=SECRET' },
    { effective: '2025-01-01' },
  ]) {
    expect(
      wildfireManifestSchema.safeParse({
        ...data.manifest,
        sources: data.manifest.sources.map((s) =>
          s.id === 'lra' ? { ...s, ...update } : s,
        ),
      }).success,
    ).toBe(false);
  }
});
it('rejects malformed rings and hazard/perimeter semantic conflation', () => {
  expect(
    caseGeometrySchema.safeParse({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      ],
    }).success,
  ).toBe(false);
  const bad = structuredClone(data);
  bad.layers[0]!.category = 'Very High';
  expect(wildfireCaseSchema.safeParse(bad).success).toBe(false);
});
it('fails closed on source tampering rather than displaying modified measurements', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aq-case-'));
  try {
    cpSync('fixtures/historical/eaton-fire-2025', dir, { recursive: true });
    const p = join(dir, 'observations.json');
    writeFileSync(p, readFileSync(p, 'utf8').replace('47.9', '49.9') + ' ');
    expect(() => loadWildfireCase(pathToFileURL(dir + '/'))).toThrow(
      'checksum',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('serves local official history without a DB/provider and refuses sample/live/query ambiguity', async () => {
  const app = createApp({
    config: { DATA_MODE: 'sample' },
    databaseStatus: async () => 'not-configured',
  });
  const good = await request(app).get(
    '/api/wildfire/eaton-fire-2025?mode=historical',
  );
  expect(good.status).toBe(200);
  expect(good.headers['cache-control']).toBe('no-store');
  expect(wildfireCaseSchema.parse(good.body).batch.observations).toHaveLength(
    71,
  );
  for (const mode of ['sample', 'live'])
    expect(
      (await request(app).get(`/api/wildfire/eaton-fire-2025?mode=${mode}`))
        .status,
    ).toBe(409);
  for (const q of ['mode=historical&mode=live', 'mode=other', 'token=SECRET'])
    expect(
      (await request(app).get(`/api/wildfire/eaton-fire-2025?${q}`)).status,
    ).toBe(400);
});
