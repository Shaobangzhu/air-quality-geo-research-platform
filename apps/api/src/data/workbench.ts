import { z } from 'zod';
import {
  exportQuerySchema,
  exportManifestSchema,
  previewResponseSchema,
  jsonExportSchema,
  transparencyCatalogSchema,
  selectStudyRegion,
} from '@aq/contracts';
import type {
  ExportRecord,
  ExportManifest,
  TransparencyCatalog,
  WildfireCase,
} from '@aq/contracts';
import type { BffService } from '../bff/service.js';
import type { AreaProductService } from '../bff/area-service.js';
import { BffError } from '../bff/errors.js';
import { validate } from '../bff/query.js';
import { hash } from '../bff/normalize.js';
import { loadWildfireCase } from '../wildfire/case.js';
export const EXPORT_LIMITS = {
  rows: 500,
  bytes: 3_000_000,
  preview: 10,
} as const;
const rawQuerySchema = exportQuerySchema.safeExtend({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(10))
    .default(10),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(499))
    .default(0),
  selectionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
const SAMPLE_LIMITS = [
  'Explicitly synthetic example; fictional identities, dates and values.',
  'Missing values remain null; absent timestamps are not zero-filled.',
  'AQI and concentration are separate source measurements; no AQI conversion or causal inference.',
];
const quote = (value: unknown) =>
  '"' + String(value).replaceAll('"', '""') + '"';
export function csvCell(value: string | number | null): string {
  if (value === null) return '"\\N"';
  if (typeof value === 'number') return String(value);
  // Keep original values in record_json; harden spreadsheet-facing string columns.
  let first = 0;
  while (
    first < value.length &&
    (value.charCodeAt(first) <= 32 || /\s/u.test(value[first]!))
  )
    first++;
  const risky =
    ['=', '+', '-', '@'].includes(value[first] ?? '') ||
    [9, 10, 13].includes(value.charCodeAt(0));
  return quote(risky || value === '\\N' ? "'" + value : value);
}
export const CSV_COLUMNS = [
  'record_type',
  'identity',
  'monitor_id',
  'parameter_id',
  'product',
  'pollutant',
  'measurement_kind',
  'value',
  'unit',
  'observed_at_utc',
  'issued_at_utc',
  'valid_date',
  'valid_from_utc',
  'valid_to_utc',
  'source_time_zone',
  'data_status',
  'raw_qualifier',
  'record_json',
  'manifest_json',
] as const;
export function csvExport(manifest: ExportManifest, rows: ExportRecord[]) {
  const metadata = CSV_COLUMNS.map((k) =>
    k === 'record_type'
      ? 'manifest'
      : k === 'manifest_json'
        ? JSON.stringify(manifest)
        : null,
  );
  const lines = [
    CSV_COLUMNS.map(quote).join(','),
    metadata.map(csvCell).join(','),
  ];
  for (const row of rows) {
    let fields: Record<string, string | number | null>;
    if (row.kind === 'station-observation') {
      const o = row.observation;
      fields = {
        identity: row.station.identity.nativeSiteId,
        monitor_id: row.station.identity.monitorId,
        parameter_id: row.station.identity.parameterId,
        product: o.product,
        pollutant: o.measurement.pollutant,
        measurement_kind: o.measurement.kind,
        value: o.measurement.value,
        unit: o.measurement.unit,
        observed_at_utc: o.observedAt,
        source_time_zone: o.period.sourceTimeZone,
        data_status: o.dataStatus,
        raw_qualifier: o.raw.qualifier,
      };
    } else {
      const r = row.record;
      fields = {
        identity: r.area.code,
        product: r.product,
        pollutant: r.pollutant,
        measurement_kind: 'aqi',
        value: r.aqi,
        unit: 'AQI',
        data_status:
          r.product === 'reporting-area-forecast' ? 'prediction' : r.dataStatus,
      };
      if (r.product === 'reporting-area-current-aqi')
        fields.observed_at_utc = r.observedAt;
      else {
        fields.issued_at_utc = r.issuedAt;
        fields.source_time_zone = r.validity.sourceTimeZone;
        if (r.validity.precision === 'date')
          fields.valid_date = r.validity.date;
        else {
          fields.valid_from_utc = r.validity.from;
          fields.valid_to_utc = r.validity.to;
        }
      }
    }
    lines.push(
      CSV_COLUMNS.map((k) =>
        csvCell(
          k === 'record_type'
            ? 'data'
            : k === 'record_json'
              ? JSON.stringify(row)
              : (fields[k] ?? null),
        ),
      ).join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
export class DataWorkbench {
  private active = 0;
  private async bounded<T>(work: () => Promise<T>) {
    if (this.active >= 4) throw new BffError('BUSY', 503, true);
    this.active++;
    try {
      return await work();
    } finally {
      this.active--;
    }
  }
  private caseValue: WildfireCase | undefined;
  constructor(
    private readonly bff: BffService,
    private readonly areas?: AreaProductService,
    private readonly caseLoader = loadWildfireCase,
    private readonly secrets: string[] = [],
    private readonly now: () => number = Date.now,
  ) {}
  private case() {
    return (this.caseValue ??= this.caseLoader());
  }
  private safe<T>(value: T): T {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (
      Buffer.byteLength(text) > EXPORT_LIMITS.bytes ||
      this.secrets.some((secret) => secret && text.includes(secret)) ||
      /[?&](?:api_?key|token|signature|email|key)=/i.test(text)
    )
      throw new BffError('UPSTREAM_MALFORMED', 502);
    return value;
  }
  async catalog() {
    const sample = await this.bff.exportSelection({
      mode: 'sample',
      windowHours: '24',
    });
    const snapshots = await this.bff.datasets({
      mode: 'historical',
      limit: '20',
    });
    const rest =
      snapshots.data.length === 20
        ? await this.bff.datasets({
            mode: 'historical',
            limit: '20',
            offset: '20',
          })
        : null;
    const stored = [...snapshots.data, ...(rest?.data ?? [])];
    const sources: TransparencyCatalog['sources'] = [
      {
        id: 'sample-stations',
        provider: 'Local synthetic fixture',
        product: sample.batch.label,
        type: 'observation',
        connection: 'local-file',
        dataStatus: 'Synthetic; no environmental validation',
        mode: 'sample',
        spatialCoverage: 'Fictional sites inside Greater LA engineering extent',
        temporalCoverage: `${sample.batch.window.from} → ${sample.batch.window.to}`,
        version: 'bff-hourly-v1',
        released: null,
        retrievedAt: sample.batch.fetchedAt,
        revision: null,
        sourceReference: 'fixture:bff-hourly-v1',
        limitations: SAMPLE_LIMITS,
      },
      {
        id: 'sample-areas',
        provider: 'Local synthetic fixture',
        product: 'Reporting-area AQI and Forecast alternatives',
        type: 'reporting-area',
        connection: 'local-file',
        dataStatus: 'Synthetic aggregates and predictions',
        mode: 'sample',
        spatialCoverage: 'Fictional Greater LA declaration; no area geometry',
        temporalCoverage:
          'Fixed January 2026 examples; forecasts retain date-only validity',
        version: 'area-products-v1',
        released: null,
        retrievedAt: null,
        revision: null,
        sourceReference: 'fixture:area-products-v1',
        limitations: SAMPLE_LIMITS,
      },
      {
        id: 'airnow',
        provider: 'AirNow',
        product: 'Hourly observations / reporting-area AQI / forecast',
        type: 'observation',
        connection: 'contract-unverified',
        dataStatus: 'Unavailable; production wire codecs not registered',
        mode: 'unavailable',
        spatialCoverage:
          'Official capability documented; no app live coverage verified',
        temporalCoverage: 'Not acquired',
        version: null,
        released: null,
        retrievedAt: null,
        revision: null,
        sourceReference: 'https://docs.airnowapi.org/webservices',
        limitations: [
          'A configured API key does not verify a service connection or validate data. No live acquisition is enabled.',
        ],
      },
      {
        id: 'arcgis',
        provider: 'Esri / ArcGIS (client)',
        product: 'Light-gray / topographic basemap and relief',
        type: 'basemap',
        connection: 'browser-managed',
        dataStatus:
          'Client basemap; current connection depends on network and public token',
        mode: 'client-context',
        spatialCoverage: 'Remote basemap context',
        temporalCoverage:
          'Current basemap context, not an as-of-2025 terrain archive',
        version: null,
        released: null,
        retrievedAt: null,
        revision: null,
        sourceReference: 'https://developers.arcgis.com/javascript/latest/',
        limitations: [
          'Browser tiles are not tracked by BFF metrics. No separate elevation dataset or 3D simulation is integrated.',
          'Restrict the deliberately public ArcGIS token by referrer and least privilege; inspect usage in the Esri account.',
        ],
      },
    ];
    const datasets: TransparencyCatalog['datasets'] = [
      {
        key: 'sample-stations',
        dataset: 'sample-stations',
        label: 'SYNTHETIC SAMPLE · station observations',
        mode: 'sample',
        window: sample.batch.window,
        validDates: [],
        pollutants: ['PM2.5', 'O3', 'PM10'],
        measurementTypes: ['concentration', 'aqi'],
      },
      {
        key: 'sample-area-aqi',
        dataset: 'sample-area-aqi',
        label: 'SYNTHETIC SAMPLE · reporting-area AQI',
        mode: 'sample',
        window: null,
        validDates: [],
        pollutants: ['PM2.5', 'O3'],
        measurementTypes: ['aqi'],
      },
      {
        key: 'sample-forecasts',
        dataset: 'sample-forecasts',
        label: 'SYNTHETIC SAMPLE · forecasts',
        mode: 'sample',
        window: null,
        validDates: [],
        pollutants: ['PM2.5', 'O3'],
        measurementTypes: ['aqi'],
      },
    ];
    if (this.areas) {
      const current = await this.areas.read('reporting-area-aqi', {
        mode: 'sample',
        pollutant: 'PM2.5',
        region: 'greater-la',
        limit: '20',
      });
      const forecast = await this.areas.read('forecast', {
        mode: 'sample',
        pollutant: 'PM2.5',
        region: 'greater-la',
        limit: '20',
      });
      const areaSource = sources.find((s) => s.id === 'sample-areas')!;
      areaSource.retrievedAt = current.meta.fetchedAt;
      areaSource.temporalCoverage = `Current sample fetched ${current.meta.fetchedAt}; forecast validity stays date-only where supplied.`;
      const dates = [
        ...new Set(
          forecast.data.flatMap((r) =>
            r.product === 'reporting-area-forecast' &&
            r.validity.precision === 'date'
              ? [r.validity.date]
              : [],
          ),
        ),
      ].sort();
      datasets.find((d) => d.dataset === 'sample-forecasts')!.validDates =
        dates;
    } else {
      sources.splice(
        sources.findIndex((s) => s.id === 'sample-areas'),
        1,
      );
      datasets.splice(1, 2);
    }
    let caseStatus: 'available' | 'blocked' = 'blocked';
    try {
      const c = this.case();
      caseStatus = 'available';
      for (const s of c.manifest.sources)
        sources.push({
          id: `eaton-${s.id}`,
          provider: s.attribution,
          product:
            s.id === 'observations'
              ? 'Eaton study · EPA hourly PM2.5'
              : `Eaton study · ${s.id === 'perimeter' ? 'Historical perimeter' : s.id.toUpperCase() + ' FHSZ'}`,
          type:
            s.id === 'observations'
              ? 'observation'
              : s.id === 'perimeter'
                ? 'perimeter'
                : 'hazard',
          connection: 'local-file',
          dataStatus:
            s.id === 'observations'
              ? 'Official historical archive; row certification unknown'
              : 'Official-source display derivative; repaired/clipped geometry',
          mode: 'historical',
          spatialCoverage: `Eaton engineering bbox: ${Object.values(c.manifest.bbox).join(', ')}`,
          temporalCoverage:
            s.id === 'observations'
              ? `${c.manifest.studyWindow.from} → ${c.manifest.studyWindow.to}`
              : s.id === 'lra'
                ? '2025 recommendations postdate Jan 7 ignition; local adoption unknown'
                : s.id === 'sra'
                  ? 'Effective April 1, 2024'
                  : 'Static historical perimeter; not hourly fire growth',
          version: s.version,
          released: s.released,
          retrievedAt: s.retrievedAt,
          revision:
            s.id === 'observations'
              ? 'Original last-change dates are retained with each exported observation; certification unknown'
              : null,
          sourceReference: s.originalUrl,
          limitations: c.manifest.limitations,
        });
      datasets.push({
        key: 'eaton-observations',
        dataset: 'eaton-observations',
        label: 'HISTORICAL · Eaton study EPA observations',
        mode: 'historical',
        window: c.batch.window,
        validDates: [],
        pollutants: ['PM2.5'],
        measurementTypes: ['concentration'],
      });
    } catch {
      /* Case availability remains separate from other datasets. */
    }
    for (const s of stored) {
      datasets.push({
        key: s.id,
        dataset: 'snapshot',
        snapshotId: s.id,
        label: `HISTORICAL DB · ${s.label}`,
        mode: 'historical',
        window: s.window,
        validDates: [],
        pollutants: ['PM2.5', 'O3', 'PM10'],
        measurementTypes: ['concentration', 'aqi'],
      });
      sources.push({
        id: s.id,
        provider:
          s.sourceId === 'epa-aqs'
            ? 'EPA AQS / AirData'
            : s.sourceId === 'airnow-hourly'
              ? 'AirNow'
              : s.sourceId,
        product: s.label,
        type: 'observation',
        connection: 'local-database',
        dataStatus: 'Official historical snapshot; inspect per-row status',
        mode: 'historical',
        spatialCoverage: JSON.stringify(s.bbox),
        temporalCoverage: `${s.window.from} → ${s.window.to}`,
        version: null,
        released: null,
        retrievedAt: s.capturedAt,
        revision: null,
        sourceReference: s.sourceReference,
        limitations: [
          'Database snapshot ID is not a provider version. Source release/row certification may be unknown.',
        ],
      });
    }
    return this.safe(
      transparencyCatalogSchema.parse({
        sources,
        datasets,
        database: snapshots.database,
        caseStatus,
        generatedAt: new Date(this.now()).toISOString(),
      }),
    );
  }
  private async selection(raw: unknown) {
    const {
      limit,
      offset,
      selectionHash: expected,
      ...query
    } = validate(rawQuerySchema, raw);
    const q = exportQuerySchema.parse(query);
    let rows: ExportRecord[];
    let identities: { id: string; label: string }[];
    let source: ExportManifest['source'];
    let fetchedAt: string;
    let coverage: ExportManifest['coverage'] = null;
    let limitations = [...SAMPLE_LIMITS];
    let sourceManifests: ExportManifest['sourceManifests'] = [];
    let dataMode: 'sample' | 'historical' = 'sample';
    if (q.dataset === 'sample-area-aqi' || q.dataset === 'sample-forecasts') {
      if (!this.areas) throw new BffError('PRODUCT_HISTORY_UNAVAILABLE');
      const result = await this.areas.read(
        q.dataset === 'sample-forecasts' ? 'forecast' : 'reporting-area-aqi',
        {
          mode: 'sample',
          region: q.region,
          pollutant: q.pollutant,
          limit: '20',
        },
      );
      const items = [...result.data];
      if (result.meta.pagination.nextOffset !== null) {
        const next = await this.areas.read(
          q.dataset === 'sample-forecasts' ? 'forecast' : 'reporting-area-aqi',
          {
            mode: 'sample',
            region: q.region,
            pollutant: q.pollutant,
            limit: '20',
            offset: String(result.meta.pagination.nextOffset),
          },
        );
        if (
          next.meta.fetchedAt !== result.meta.fetchedAt ||
          next.meta.pagination.nextOffset !== null
        )
          throw new BffError('UPSTREAM_MALFORMED', 502);
        items.push(...next.data);
      }
      identities = [
        ...new Map(
          items.map((r) => [
            r.area.id,
            { id: r.area.id, label: `${r.area.name} · ${r.area.code}` },
          ]),
        ).values(),
      ];
      if (q.areaId && !identities.some((i) => i.id === q.areaId))
        throw new BffError('INVALID_REQUEST', 400);
      rows = items
        .filter(
          (r) =>
            (!q.areaId || r.area.id === q.areaId) &&
            (!q.validFromDate ||
              (r.product === 'reporting-area-forecast' &&
                r.validity.precision === 'date' &&
                r.validity.date >= q.validFromDate &&
                r.validity.date < q.validToDate!)),
        )
        .map((record) => ({ kind: 'area-product', record }));
      source = {
        provider: 'synthetic',
        label: result.meta.source.label,
        reference: result.meta.source.reference,
        version: 'area-products-v1',
        release: null,
        snapshotId: null,
        checksum: null,
      };
      fetchedAt = result.meta.fetchedAt;
      limitations.push(
        'Forecast date-only validity is not converted to a midnight UTC instant. Unknown issuance/observation times remain null.',
      );
    } else {
      let batch;
      let observations;
      if (q.dataset === 'eaton-observations') {
        let c: WildfireCase;
        try {
          c = this.case();
        } catch {
          throw new BffError('UPSTREAM_MALFORMED', 503);
        }
        batch = c.batch;
        dataMode = 'historical';
        const s = c.manifest.sources.find((s) => s.id === 'observations')!;
        source = {
          provider: 'EPA AirData / AQS',
          label: batch.label,
          reference: s.originalUrl,
          version: s.version,
          release: s.released,
          snapshotId: null,
          checksum: s.sha256,
        };
        limitations = [...c.manifest.limitations, s.limitations];
        sourceManifests = c.manifest.sources.map((s) => ({
          id: s.id,
          version: s.version,
          reference: s.originalUrl,
          sha256: s.sha256,
          released: s.released,
          effective: s.effective,
          retrievedAt: s.retrievedAt,
        }));
        observations = batch.observations;
      } else {
        const selection = await this.bff.exportSelection({
          mode: q.dataset === 'snapshot' ? 'historical' : 'sample',
          region: q.region,
          pollutant: q.pollutant,
          measurementType: q.measurementType,
          windowHours: q.from
            ? String((Date.parse(q.to!) - Date.parse(q.from)) / 3600000)
            : q.dataset === 'snapshot'
              ? '72'
              : '24',
          ...(q.to ? { endAt: q.to } : {}),
          ...(q.snapshotId ? { snapshotId: q.snapshotId } : {}),
        });
        batch = selection.batch;
        observations = selection.observations;
        const snapshotId = selection.snapshotId;
        dataMode = batch.dataMode === 'sample' ? 'sample' : 'historical';
        source = {
          provider:
            batch.sourceId === 'epa-aqs'
              ? 'EPA AQS / AirData'
              : batch.sourceId === 'airnow-hourly'
                ? 'AirNow'
                : 'synthetic',
          label: batch.label,
          reference: batch.sourceReference,
          version: dataMode === 'sample' ? 'bff-hourly-v1' : null,
          release: null,
          snapshotId,
          checksum: hash(batch),
        };
        if (dataMode === 'historical')
          limitations = [
            'Historical snapshot provenance does not establish per-row certification.',
            'Source release/version may be unknown; all supplied row provenance, periods and flags are retained.',
            'Null values are distinct from zero; absent records are not fabricated.',
          ];
      }
      fetchedAt = batch.fetchedAt;
      coverage = batch.window;
      const from = q.from ?? batch.window.from,
        to = q.to ?? batch.window.to;
      if (
        Date.parse(from) < Date.parse(batch.window.from) ||
        Date.parse(to) > Date.parse(batch.window.to)
      )
        throw new BffError('UNSUPPORTED_RANGE', 400);
      const b = selectStudyRegion(q.region).bbox;
      const stations = batch.stations.filter(
        (s) =>
          s.coordinate.longitude >= b.west &&
          s.coordinate.longitude <= b.east &&
          s.coordinate.latitude >= b.south &&
          s.coordinate.latitude <= b.north,
      );
      const scoped = observations.filter(
        (o) =>
          stations.some((s) => s.id === o.stationId) &&
          o.measurement.pollutant === q.pollutant &&
          o.measurement.kind === q.measurementType &&
          Date.parse(o.observedAt) >= Date.parse(from) &&
          Date.parse(o.observedAt) < Date.parse(to),
      );
      identities = stations
        .filter((s) => scoped.some((o) => o.stationId === s.id))
        .map((s) => ({
          id: s.id,
          label: `${s.name} · POC ${s.identity.monitorId ?? 'unknown'} · ${s.identity.parameterId ?? 'unknown'}`,
        }));
      if (q.stationId && !stations.some((s) => s.id === q.stationId))
        throw new BffError('STATION_NOT_FOUND', 404);
      rows = scoped
        .filter((o) => !q.stationId || o.stationId === q.stationId)
        .map((observation) => ({
          kind: 'station-observation',
          observation,
          station: stations.find((s) => s.id === observation.stationId)!,
        }));
    }
    if (rows.length > EXPORT_LIMITS.rows)
      throw new BffError('UPSTREAM_TOO_LARGE', 413);
    const orderKey = (r: ExportRecord) => {
      if (r.kind === 'station-observation')
        return `${r.observation.observedAt}|${r.station.id}|${r.observation.id}`;
      const row = r.record;
      const time =
        row.product === 'reporting-area-current-aqi'
          ? (row.observedAt ?? '\uffff')
          : row.validity.precision === 'date'
            ? row.validity.date
            : row.validity.from;
      return `${time}|${row.area.id}|${JSON.stringify(row)}`;
    };
    rows.sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
    const digest = hash({ query: q, source, sourceManifests, rows });
    if (expected && digest !== expected)
      throw new BffError('INVALID_REQUEST', 409);
    const unique = (values: string[]) => [...new Set(values)].sort();
    const manifest = exportManifestSchema.parse({
      schemaVersion: 'aq-export-v1',
      dataset: q.dataset,
      dataMode,
      query: q,
      generatedAt: new Date(this.now()).toISOString(),
      fetchedAt,
      indexedAt: null,
      selectionHash: digest,
      rowCount: rows.length,
      source,
      coverage,
      units: unique(
        rows.map((r) =>
          r.kind === 'station-observation'
            ? r.observation.measurement.unit
            : 'AQI',
        ),
      ),
      measurementKinds: unique(
        rows.map((r) =>
          r.kind === 'station-observation'
            ? r.observation.measurement.kind
            : 'aqi',
        ),
      ),
      averaging: unique(
        rows.flatMap((r) =>
          r.kind === 'station-observation'
            ? [r.observation.period.averagingDescription]
            : [],
        ),
      ),
      timeZones: unique(
        rows.flatMap((r) =>
          r.kind === 'station-observation'
            ? [r.observation.period.sourceTimeZone]
            : r.record.product === 'reporting-area-forecast'
              ? [r.record.validity.sourceTimeZone ?? 'unknown source timezone']
              : ['unknown unless explicitly supplied'],
        ),
      ),
      limitations,
      sourceManifests,
      encoding: 'UTF-8',
      csvNull: '\\N',
      csvSafety:
        'manifest row then data rows; RFC4180; risky strings prefixed with apostrophe; record_json is lossless',
    });
    this.safe({ manifest, rows });
    return { manifest, rows, identities, limit, offset, query: q };
  }
  async preview(raw: unknown) {
    return this.bounded(() => this.previewSelection(raw));
  }
  async export(format: 'json' | 'csv', raw: unknown) {
    return this.bounded(() => this.exportSelection(format, raw));
  }
  private async previewSelection(raw: unknown) {
    const s = await this.selection(raw);
    return this.safe(
      previewResponseSchema.parse({
        manifest: s.manifest,
        data: s.rows.slice(s.offset, s.offset + s.limit),
        identities: s.identities,
        pagination: {
          offset: s.offset,
          limit: s.limit,
          total: s.rows.length,
          nextOffset:
            s.offset + s.limit < s.rows.length ? s.offset + s.limit : null,
        },
      }),
    );
  }
  private async exportSelection(format: 'json' | 'csv', raw: unknown) {
    // Export must be pinned to a previously inspected selection, and never takes pagination.
    if (
      !raw ||
      typeof raw !== 'object' ||
      !Object.hasOwn(raw, 'selectionHash') ||
      Object.hasOwn(raw, 'limit') ||
      Object.hasOwn(raw, 'offset')
    )
      throw new BffError('INVALID_REQUEST', 400);
    const s = await this.selection(raw);
    const body =
      format === 'json'
        ? JSON.stringify(
            jsonExportSchema.parse({ manifest: s.manifest, data: s.rows }),
            null,
            2,
          ) + '\n'
        : csvExport(s.manifest, s.rows);
    this.safe(body);
    return {
      body,
      filename: `aq-${s.query.dataset}-${s.manifest.selectionHash.slice(0, 12)}.${format}`,
      type:
        format === 'json'
          ? 'application/json; charset=utf-8'
          : 'text/csv; charset=utf-8',
    };
  }
}
