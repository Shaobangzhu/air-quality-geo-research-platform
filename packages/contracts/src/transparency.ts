import { z } from 'zod';
import {
  utcTimestampSchema,
  dataModeSchema,
  regionIdSchema,
  pollutantSchema,
} from './domain.js';
import { observationSchema, stationSchema, stationIdSchema } from './bff.js';
import { areaRecordSchema, areaIdSchema } from './area-products.js';
export const dataTabSchema = z.enum(['sources', 'preview', 'methods', 'usage']);
export const exportDatasetSchema = z.enum([
  'sample-stations',
  'sample-area-aqi',
  'sample-forecasts',
  'eaton-observations',
  'snapshot',
]);
export const sourceReferenceSchema = z
  .string()
  .max(400)
  .refine((value) => {
    if (['fixture:bff-hourly-v1', 'fixture:area-products-v1'].includes(value))
      return true;
    try {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        [
          'aqs.epa.gov',
          'www.epa.gov',
          'docs.airnowapi.org',
          'www.fire.ca.gov',
          'osfm.fire.ca.gov',
          'services1.arcgis.com',
          'developers.arcgis.com',
        ].includes(u.hostname)
      );
    } catch {
      return false;
    }
  });
export const integratedSourceSchema = z.strictObject({
  id: z.string().max(80),
  provider: z.string().max(100),
  product: z.string().max(180),
  type: z.enum([
    'observation',
    'reporting-area',
    'forecast',
    'perimeter',
    'hazard',
    'basemap',
  ]),
  connection: z.enum([
    'local-file',
    'local-database',
    'contract-unverified',
    'browser-managed',
  ]),
  dataStatus: z.string().max(200),
  mode: z.enum(['sample', 'historical', 'unavailable', 'client-context']),
  spatialCoverage: z.string().max(300),
  temporalCoverage: z.string().max(300),
  version: z.string().max(200).nullable(),
  released: z.string().max(100).nullable(),
  retrievedAt: utcTimestampSchema.nullable(),
  revision: z.string().max(250).nullable(),
  sourceReference: sourceReferenceSchema,
  limitations: z.array(z.string().max(700)).max(16),
});
export const exportQuerySchema = z
  .strictObject({
    dataset: exportDatasetSchema,
    region: regionIdSchema.default('greater-la'),
    pollutant: pollutantSchema.default('PM2.5'),
    measurementType: z.enum(['aqi', 'concentration']).default('concentration'),
    snapshotId: z.uuid().optional(),
    stationId: stationIdSchema.optional(),
    areaId: areaIdSchema.optional(),
    from: utcTimestampSchema.optional(),
    to: utcTimestampSchema.optional(),
    validFromDate: z.iso.date().optional(),
    validToDate: z.iso.date().optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if ((q.dataset === 'snapshot') !== !!q.snapshotId)
      issue('Snapshot identity required only for stored snapshots.');
    if (!!q.from !== !!q.to) issue('Both UTC bounds required.');
    if (
      q.from &&
      q.to &&
      (Date.parse(q.from) >= Date.parse(q.to) ||
        Date.parse(q.to) - Date.parse(q.from) > 72 * 3600000 ||
        Date.parse(q.from) % 3600000 ||
        Date.parse(q.to) % 3600000)
    )
      issue('Ordered whole-hour interval up to 72 hours required.');
    if (
      !!q.validFromDate !== !!q.validToDate ||
      (q.validFromDate && q.validToDate && q.validFromDate >= q.validToDate)
    )
      issue('Ordered date bounds required (exclusive end).');
    const area =
      q.dataset === 'sample-area-aqi' || q.dataset === 'sample-forecasts';
    if (area && (q.stationId || q.from || q.measurementType !== 'aqi'))
      issue('Area products have no station/concentration/hourly query.');
    if (!area && q.areaId) issue('Station products have no area identity.');
    if (q.dataset !== 'sample-forecasts' && q.validFromDate)
      issue('Date-only validity belongs to forecasts.');
  });
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export const exportRecordSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('station-observation'),
    station: stationSchema,
    observation: observationSchema,
  }),
  z.strictObject({ kind: z.literal('area-product'), record: areaRecordSchema }),
]);
export type ExportRecord = z.infer<typeof exportRecordSchema>;
export const exportDatasetOptionSchema = z.strictObject({
  key: z.string().max(80),
  dataset: exportDatasetSchema,
  snapshotId: z.uuid().optional(),
  label: z.string().max(180),
  mode: z.enum(['sample', 'historical']),
  window: z
    .strictObject({ from: utcTimestampSchema, to: utcTimestampSchema })
    .nullable(),
  validDates: z.array(z.iso.date()).max(10),
  pollutants: z.array(pollutantSchema).max(3),
  measurementTypes: z.array(z.enum(['aqi', 'concentration'])).max(2),
});
export const transparencyCatalogSchema = z.strictObject({
  sources: z.array(integratedSourceSchema).max(50),
  datasets: z.array(exportDatasetOptionSchema).max(36),
  database: z.enum(['available', 'unavailable']),
  caseStatus: z.enum(['available', 'blocked']),
  generatedAt: utcTimestampSchema,
});
export const exportManifestSchema = z.strictObject({
  schemaVersion: z.literal('aq-export-v1'),
  dataset: exportDatasetSchema,
  dataMode: dataModeSchema,
  query: exportQuerySchema,
  generatedAt: utcTimestampSchema,
  fetchedAt: utcTimestampSchema,
  indexedAt: utcTimestampSchema.nullable(),
  selectionHash: z.string().regex(/^[a-f0-9]{64}$/),
  rowCount: z.number().int().min(0).max(500),
  source: z.strictObject({
    provider: z.string().max(100),
    label: z.string().max(180),
    reference: sourceReferenceSchema,
    version: z.string().max(200).nullable(),
    release: z.string().max(100).nullable(),
    snapshotId: z.uuid().nullable(),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  }),
  coverage: z
    .strictObject({ from: utcTimestampSchema, to: utcTimestampSchema })
    .nullable(),
  units: z.array(z.string().max(50)).max(5),
  measurementKinds: z.array(z.string().max(40)).max(3),
  averaging: z.array(z.string().max(500)).max(100),
  timeZones: z.array(z.string().max(100)).max(10),
  limitations: z.array(z.string().max(700)).max(20),
  sourceManifests: z
    .array(
      z.strictObject({
        id: z.string().max(80),
        version: z.string().max(200),
        reference: sourceReferenceSchema,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        released: z.string().max(100),
        effective: z.iso.date().nullable(),
        retrievedAt: utcTimestampSchema,
      }),
    )
    .max(4),
  encoding: z.literal('UTF-8'),
  csvNull: z.literal('\\N'),
  csvSafety: z.literal(
    'manifest row then data rows; RFC4180; risky strings prefixed with apostrophe; record_json is lossless',
  ),
});
export type ExportManifest = z.infer<typeof exportManifestSchema>;
export const previewResponseSchema = z.strictObject({
  manifest: exportManifestSchema,
  data: z.array(exportRecordSchema).max(10),
  identities: z
    .array(
      z.strictObject({ id: z.string().max(100), label: z.string().max(250) }),
    )
    .max(256),
  pagination: z.strictObject({
    offset: z.number().int().min(0).max(499),
    limit: z.number().int().min(1).max(10),
    total: z.number().int().min(0).max(500),
    nextOffset: z.number().int().nullable(),
  }),
});
export const jsonExportSchema = z
  .strictObject({
    manifest: exportManifestSchema,
    data: z.array(exportRecordSchema).max(500),
  })
  .refine(
    (e) => e.manifest.rowCount === e.data.length,
    'Export count must match actual rows.',
  );
export type PreviewResponse = z.infer<typeof previewResponseSchema>;
export type TransparencyCatalog = z.infer<typeof transparencyCatalogSchema>;
