import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  jsonExportSchema,
  previewResponseSchema,
  transparencyCatalogSchema,
} from '@aq/contracts';
import { areaHarness } from '../helpers/areas.js';
import { harness, manifest } from '../helpers/bff.js';
import { DataWorkbench, csvCell } from '../../apps/api/src/data/workbench.js';
import { SampleProvider } from '../../apps/api/src/bff/providers.js';
import { importRowSchema } from '../../apps/api/src/bff/normalize.js';
function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]!;
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && csv[i + 1] === '\n' && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += c;
  }
  return rows;
}
const sampleQuery = {
  dataset: 'sample-stations',
  region: 'greater-la',
  pollutant: 'PM2.5',
  measurementType: 'concentration',
};
const caseQuery = {
  dataset: 'eaton-observations',
  region: 'greater-la',
  pollutant: 'PM2.5',
  measurementType: 'concentration',
};
describe('bounded data transparency and export', () => {
  it('reports genuine integrations separately from connection and scientific validation', async () => {
    const h = areaHarness();
    const result = await request(h.app).get('/api/data/catalog');
    expect(result.status).toBe(200);
    const c = transparencyCatalogSchema.parse(result.body);
    expect(c.sources.find((s) => s.id === 'airnow')).toMatchObject({
      connection: 'contract-unverified',
      mode: 'unavailable',
      version: null,
      retrievedAt: null,
    });
    expect(c.sources.find((s) => s.id === 'eaton-observations')).toMatchObject({
      connection: 'local-file',
      mode: 'historical',
      dataStatus: 'Official historical archive; row certification unknown',
    });
    expect(
      c.sources.find((s) => s.id === 'eaton-lra')?.temporalCoverage,
    ).toContain('postdate');
    expect(
      c.sources.find((s) => s.id === 'arcgis')?.limitations.join(' '),
    ).toContain('not tracked');
    expect(c.sources.some((s) => s.provider === 'CARB')).toBe(false);
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.station.live.load).not.toHaveBeenCalled();
    expect(h.usage.summary().providers.every((p) => p.requests === 0)).toBe(
      true,
    );
  });
  it('exports exactly the pinned selection with original null/zero/negative values and timestamps', async () => {
    const h = areaHarness();
    const p = previewResponseSchema.parse(
      (await request(h.app).get('/api/data/preview').query(sampleQuery)).body,
    );
    expect(p.data.length).toBeLessThanOrEqual(10);
    expect(p.manifest.dataMode).toBe('sample');
    const response = await request(h.app)
      .get('/api/exports/json')
      .query({ ...sampleQuery, selectionHash: p.manifest.selectionHash });
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="aq-sample-stations-[a-f0-9]{12}\.json"$/,
    );
    const output = jsonExportSchema.parse(response.body);
    expect(output.data.slice(0, 10)).toEqual(p.data);
    expect(output.manifest.query).toEqual(p.manifest.query);
    expect(output.manifest.selectionHash).toBe(p.manifest.selectionHash);
    const values = output.data.map((r) =>
      r.kind === 'station-observation'
        ? r.observation.measurement.value
        : undefined,
    );
    expect(values).toContain(null);
    expect(values).toContain(0);
    expect(values).toContain(-0.2);
    expect(output.manifest.units).toEqual(['µg/m³']);
    expect(output.manifest.timeZones.length).toBeGreaterThan(0);
    expect(
      output.data.every(
        (r) =>
          r.kind === 'station-observation' &&
          r.observation.observedAt.endsWith('Z'),
      ),
    ).toBe(true);
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('round-trips CSV record JSON and embedded manifest, including empty selections', async () => {
    const h = areaHarness();
    const work = new DataWorkbench(h.station.service, h.areas);
    for (const query of [
      sampleQuery,
      {
        ...caseQuery,
        from: '2025-01-08T13:00:00Z',
        to: '2025-01-08T14:00:00Z',
      },
    ]) {
      const p = await work.preview(query);
      const exported = await work.export('csv', {
        ...query,
        selectionHash: p.manifest.selectionHash,
      });
      const csv = parseCsv(exported.body);
      const columns = csv[0]!;
      const manifest = JSON.parse(csv[1]![columns.indexOf('manifest_json')]!);
      expect(manifest.selectionHash).toBe(p.manifest.selectionHash);
      expect(csv[1]![0]).toBe('manifest');
      const records = csv
        .slice(2)
        .map((r) => JSON.parse(r[columns.indexOf('record_json')]!));
      const json = jsonExportSchema.parse(
        JSON.parse(
          (
            await work.export('json', {
              ...query,
              selectionHash: p.manifest.selectionHash,
            })
          ).body,
        ),
      );
      expect(records).toEqual(json.data);
      expect(records.length).toBe(manifest.rowCount);
      if (query.dataset === 'sample-stations') {
        expect(exported.body).toContain('"\\N"');
        expect(
          csv.slice(2).some((r) => r[columns.indexOf('value')] === '0'),
        ).toBe(true);
      } else expect(records).toHaveLength(0);
    }
  });
  it('hardens spreadsheet formulas while preserving the original untrusted text in JSON', async () => {
    for (const value of [
      '=1+1',
      ' +SUM(A1:A2)',
      '\t@SUM(1)',
      '\r-cmd',
      '\u0000=cmd',
      '\\N',
    ])
      expect(csvCell(value)).toContain("'");
    expect(csvCell(-0.2)).toBe('-0.2');
    expect(csvCell(0)).toBe('0');
    const file = manifest();
    const row = importRowSchema.parse(file.rows[0]);
    row.identity.nativeSiteId = 'SAMPLE-=FORMULA';
    row.name = '=HYPERLINK("evil","text")';
    row.raw.qualifier = '\t=SUM(1)';
    file.rows = [row];
    const h = harness({ sample: new SampleProvider(file) });
    const work = new DataWorkbench(h.service);
    const q = { ...sampleQuery, measurementType: row.measurement.kind };
    const preview = await work.preview(q);
    const csv = parseCsv(
      (
        await work.export('csv', {
          ...q,
          selectionHash: preview.manifest.selectionHash,
        })
      ).body,
    );
    const original = JSON.parse(csv[2]![csv[0]!.indexOf('record_json')]!);
    expect(original.station.name).toBe(row.name);
    expect(csv[2]![csv[0]!.indexOf('raw_qualifier')]).toBe("'\t=SUM(1)");
  });
  it('preserves date-only category-only forecasts, null issuance, and area identities', async () => {
    const h = areaHarness();
    const work = new DataWorkbench(h.station.service, h.areas);
    const q = {
      dataset: 'sample-forecasts',
      measurementType: 'aqi',
      validFromDate: '2026-01-16',
      validToDate: '2026-01-17',
    };
    const p = await work.preview(q);
    expect(p.manifest.rowCount).toBe(1);
    expect(p.data[0]).toMatchObject({
      kind: 'area-product',
      record: {
        issuedAt: null,
        aqi: null,
        category: 'Moderate',
        validity: {
          precision: 'date',
          date: '2026-01-16',
          sourceTimeZone: null,
        },
      },
    });
    const csv = parseCsv(
      (
        await work.export('csv', {
          ...q,
          selectionHash: p.manifest.selectionHash,
        })
      ).body,
    );
    expect(csv[2]![csv[0]!.indexOf('valid_date')]).toBe('2026-01-16');
    expect(csv[2]![csv[0]!.indexOf('observed_at_utc')]).toBe('\\N');
  });
  it('pages the real historical case and retains its exact source manifests, revision and certification limits', async () => {
    const h = areaHarness();
    const work = new DataWorkbench(h.station.service, h.areas);
    const first = await work.preview(caseQuery),
      last = await work.preview({ ...caseQuery, offset: '70' });
    expect(first.manifest.rowCount).toBe(71);
    expect(first.data[0]).toMatchObject({
      kind: 'station-observation',
      observation: { observedAt: '2025-01-06T08:00:00Z' },
    });
    expect(last.data).toHaveLength(1);
    expect(last.manifest.selectionHash).toBe(first.manifest.selectionHash);
    expect(first.manifest.sourceManifests).toHaveLength(4);
    expect(first.manifest.source.version).toContain('2026-06-25');
    expect(first.manifest.indexedAt).toBeNull();
    expect(first.manifest.limitations.join(' ')).toContain('certification');
  });
  it('rejects overlarge selections, ambiguous queries, unpinned exports and substituted datasets', async () => {
    const h = areaHarness();
    const p = await new DataWorkbench(h.station.service, h.areas).preview(
      sampleQuery,
    );
    for (const query of [
      { dataset: '../../.env' },
      { ...sampleQuery, limit: '11' },
      { ...sampleQuery, offset: '500' },
      { ...sampleQuery, from: '2025-01-01T00:00:00Z' },
      {
        ...sampleQuery,
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
      },
      { ...sampleQuery, stationId: 'SELECT *' },
      { ...sampleQuery, token: 'SECRET' },
    ])
      expect(
        (await request(h.app).get('/api/data/preview').query(query)).status,
      ).toBe(400);
    expect(
      (
        await request(h.app).get(
          '/api/data/preview?dataset=sample-stations&dataset=eaton-observations',
        )
      ).status,
    ).toBe(400);
    expect(
      (await request(h.app).get('/api/exports/json').query(sampleQuery)).status,
    ).toBe(400);
    expect(
      (
        await request(h.app)
          .get('/api/exports/json')
          .query({ ...caseQuery, selectionHash: p.manifest.selectionHash })
      ).status,
    ).toBe(409);
    const f = manifest(),
      base = importRowSchema.parse(f.rows[0]);
    base.measurement = {
      kind: 'concentration',
      pollutant: 'PM2.5',
      unit: 'µg/m³',
      value: 0,
    };
    f.rows = Array.from({ length: 501 }, (_, i) => ({
      ...base,
      identity: {
        ...base.identity,
        nativeSiteId: `SAMPLE-LOAD-${Math.floor(i / 3)}`,
      },
      observedAt: `2026-01-15T${String(17 + (i % 3)).padStart(2, '0')}:00:00Z`,
    }));
    const bulk = harness({ sample: new SampleProvider(f) });
    await expect(
      new DataWorkbench(bulk.service).preview(sampleQuery),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('fails safely when case assets, DB or credentials in stored payloads are unavailable/unsafe', async () => {
    const h = areaHarness();
    const blocked = new DataWorkbench(h.station.service, h.areas, () => {
      throw new Error('private path');
    });
    expect((await blocked.catalog()).caseStatus).toBe('blocked');
    await expect(blocked.preview(caseQuery)).rejects.toMatchObject({
      code: 'UPSTREAM_MALFORMED',
    });
    const f = manifest();
    const row = importRowSchema.parse(f.rows[0]);
    row.name = 'SERVER_ONLY_SECRET';
    f.rows = [row];
    const privateStore = harness({ sample: new SampleProvider(f) });
    await expect(
      new DataWorkbench(privateStore.service, undefined, undefined, [
        'SERVER_ONLY_SECRET',
      ]).preview({ ...sampleQuery, measurementType: row.measurement.kind }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_MALFORMED' });
    await expect(
      new DataWorkbench(h.station.service).preview({
        ...sampleQuery,
        dataset: 'snapshot',
        snapshotId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_NOT_FOUND' });
  });
});
it('bounds concurrent preview/export work and releases slots after completion', async () => {
  const batch = await new SampleProvider(manifest()).load();
  let resolve!: (value: typeof batch) => void;
  const h = harness({
    sample: {
      load: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  const service = new DataWorkbench(h.service);
  const pending = Array.from({ length: 4 }, () => service.preview(sampleQuery));
  await expect(service.preview(sampleQuery)).rejects.toMatchObject({
    code: 'BUSY',
  });
  resolve(batch);
  await Promise.all(pending);
  expect(
    (await service.preview(sampleQuery)).manifest.rowCount,
  ).toBeGreaterThan(0);
});
