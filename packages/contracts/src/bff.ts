import { z } from 'zod';
import {
  bboxSchema,
  coordinateSchema,
  dataModeSchema,
  measurementSchema,
  periodSchema,
  pollutantSchema,
  rawMeasurementSchema,
  utcTimestampSchema,
  validationStatusSchema,
} from './domain.js';

export const sourceIdSchema = z.enum([
  'synthetic-stations-v1',
  'airnow-hourly',
  'epa-aqs',
]);
export const providerSchema = z.enum(['synthetic', 'airnow', 'aqs']);
export const measurementTypeSchema = z.enum(['aqi', 'concentration']);
export const stationIdSchema = z.string().regex(/^s_[a-f0-9]{32}$/);
export const stationIdentitySchema = z.strictObject({
  provider: providerSchema,
  nativeSiteId: z.string().min(1).max(100),
  monitorId: z.string().min(1).max(100).nullable(),
  parameterId: z.string().min(1).max(100).nullable(),
});
export const stationSchema = z.strictObject({
  id: stationIdSchema,
  identity: stationIdentitySchema,
  name: z.string().min(1).max(200),
  coordinate: coordinateSchema,
  sourceAgency: z.string().min(1).max(200),
});
export const publicSourceReferenceSchema = z
  .string()
  .min(1)
  .max(350)
  .refine((value) => {
    if (value === 'fixture:bff-hourly-v1') return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        [
          'docs.airnowapi.org',
          'files.airnowtech.org',
          'aqs.epa.gov',
          'www.epa.gov',
        ].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }, 'Requires a credential-free official reference or the named synthetic fixture.');
export const bffProvenanceSchema = z.strictObject({
  sourceId: sourceIdSchema,
  transportProvider: providerSchema,
  sourceAgency: z.string().min(1).max(200),
  sourceReference: publicSourceReferenceSchema,
  origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
  label: z.string().min(1).max(160),
});
export const observationSchema = z.strictObject({
  id: z.string().regex(/^o_[a-f0-9]{40}$/),
  stationId: stationIdSchema,
  product: z.literal('observation'),
  observedAt: utcTimestampSchema,
  fetchedAt: utcTimestampSchema,
  period: periodSchema.refine(
    (period) =>
      period.averagingDescription.length <= 500 &&
      period.sourceTimeZone.length <= 100,
  ),
  measurement: measurementSchema,
  raw: rawMeasurementSchema.refine(
    (raw) =>
      raw.unit.length <= 32 &&
      raw.parameter.length <= 60 &&
      (raw.qualifier?.length ?? 0) <= 200,
  ),
  dataStatus: validationStatusSchema,
  dataMode: dataModeSchema,
  provenance: bffProvenanceSchema,
});
export const diagnosticsSchema = z.strictObject({
  inputRows: z.number().int().min(0).max(2000),
  rejectedRows: z.number().int().nonnegative(),
  duplicateRows: z.number().int().nonnegative(),
  conflictingRows: z.number().int().nonnegative(),
  missingValues: z.number().int().nonnegative(),
  rejectedRowIndexes: z.array(z.number().int().nonnegative()).max(20),
});
export const resultStateSchema = z.enum(['complete', 'partial', 'empty']);
export const batchSchema = z
  .strictObject({
    dataMode: dataModeSchema,
    sourceId: sourceIdSchema,
    region: z.literal('greater-la'),
    bbox: bboxSchema,
    window: z.strictObject({
      from: utcTimestampSchema,
      to: utcTimestampSchema,
    }),
    fetchedAt: utcTimestampSchema,
    origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
    label: z.string().min(1).max(160),
    sourceReference: publicSourceReferenceSchema,
    importMethod: z.enum(['fixture', 'curated-file', 'live-fetch']),
    resultState: resultStateSchema,
    stations: z.array(stationSchema).max(256),
    observations: z.array(observationSchema).max(2000),
    diagnostics: diagnosticsSchema,
  })
  .superRefine((batch, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (Date.parse(batch.window.from) >= Date.parse(batch.window.to))
      issue('Invalid snapshot interval.');
    if (
      Date.parse(batch.window.from) < Date.parse('1970-01-01T00:00:00Z') ||
      Date.parse(batch.window.to) >= Date.parse('2101-01-01T00:00:00Z')
    )
      issue('Snapshot dates exceed application bounds.');
    if (
      Date.parse(batch.window.to) - Date.parse(batch.window.from) >
      72 * 3_600_000
    )
      issue('Snapshot interval exceeds 72 hours.');
    if ((batch.dataMode === 'sample') !== (batch.origin === 'synthetic'))
      issue('Synthetic origins belong exclusively to sample mode.');
    if (
      batch.dataMode === 'historical' &&
      batch.origin !== 'official-historical'
    )
      issue('Historical requires an official curated snapshot.');
    if (batch.dataMode === 'live' && batch.origin !== 'provider-live')
      issue('Live requires provider provenance.');
    if (
      (batch.sourceId === 'synthetic-stations-v1') !==
      (batch.dataMode === 'sample')
    )
      issue('Synthetic source cannot impersonate official data.');
    if (
      batch.dataMode === 'sample' &&
      (!batch.label.startsWith('SYNTHETIC SAMPLE') ||
        batch.sourceReference !== 'fixture:bff-hourly-v1' ||
        batch.importMethod !== 'fixture')
    )
      issue('Samples require an explicit label and fixture provenance.');
    if (
      batch.dataMode !== 'sample' &&
      batch.sourceReference === 'fixture:bff-hourly-v1'
    )
      issue('Official modes require an official source reference.');
    const ids = new Set(batch.stations.map((station) => station.id));
    if (ids.size !== batch.stations.length)
      issue('Duplicate station identity.');
    if (
      new Set(batch.observations.map((row) => row.id)).size !==
      batch.observations.length
    )
      issue('Duplicate observation revision.');
    for (const station of batch.stations) {
      const expectedProvider =
        batch.sourceId === 'synthetic-stations-v1'
          ? 'synthetic'
          : batch.sourceId === 'airnow-hourly'
            ? 'airnow'
            : 'aqs';
      if (station.identity.provider !== expectedProvider)
        issue('Station identity provider does not match source.');
      if (
        batch.dataMode === 'sample' &&
        (!station.identity.nativeSiteId.startsWith('SAMPLE-') ||
          station.identity.provider !== 'synthetic')
      )
        issue('Sample stations require fictional IDs.');
      if (
        batch.dataMode !== 'sample' &&
        (station.identity.nativeSiteId.startsWith('SAMPLE-') ||
          station.identity.provider === 'synthetic')
      )
        issue('Official modes cannot use synthetic stations.');
      if (
        station.coordinate.longitude < batch.bbox.west ||
        station.coordinate.longitude > batch.bbox.east ||
        station.coordinate.latitude < batch.bbox.south ||
        station.coordinate.latitude > batch.bbox.north
      )
        issue('Station outside snapshot extent.');
    }
    for (const row of batch.observations) {
      if (
        row.provenance.sourceReference !== batch.sourceReference ||
        row.provenance.label !== batch.label ||
        Date.parse(row.fetchedAt) !== Date.parse(batch.fetchedAt)
      )
        issue('Observation acquisition provenance does not match snapshot.');
      if (
        !ids.has(row.stationId) ||
        row.dataMode !== batch.dataMode ||
        row.provenance.origin !== batch.origin ||
        row.provenance.sourceId !== batch.sourceId
      )
        issue('Observation provenance does not match snapshot.');
      if (
        Date.parse(row.observedAt) < Date.parse(batch.window.from) ||
        Date.parse(row.observedAt) >= Date.parse(batch.window.to)
      )
        issue('Observation outside snapshot interval.');
      if (
        row.provenance.transportProvider === 'airnow' &&
        row.dataStatus === 'validated'
      )
        issue('AirNow observations cannot be labeled validated.');
      const station = batch.stations.find((item) => item.id === row.stationId);
      if (
        station &&
        (station.identity.provider !== row.provenance.transportProvider ||
          station.sourceAgency !== row.provenance.sourceAgency)
      )
        issue('Observation agency/provider does not match station.');
    }
  });
export const errorCodeSchema = z.enum([
  'ROUTE_NOT_FOUND',
  'INVALID_REQUEST',
  'STATION_NOT_FOUND',
  'SNAPSHOT_REQUIRED',
  'SNAPSHOT_NOT_FOUND',
  'SNAPSHOT_MODE_MISMATCH',
  'UNSUPPORTED_RANGE',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_CONTRACT_UNVERIFIED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_SERVER_ERROR',
  'UPSTREAM_REJECTED',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_NETWORK',
  'UPSTREAM_FORMAT',
  'UPSTREAM_TOO_LARGE',
  'UPSTREAM_MALFORMED',
  'DATABASE_UNAVAILABLE',
  'STORAGE_LIMIT',
  'BUSY',
  'INTERNAL_ERROR',
]);
export const errorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
});
export const snapshotSchema = z.strictObject({
  id: z.uuid(),
  sourceId: sourceIdSchema,
  dataMode: dataModeSchema,
  origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
  label: z.string(),
  capturedAt: utcTimestampSchema,
  region: z.literal('greater-la'),
  bbox: bboxSchema,
  sourceReference: publicSourceReferenceSchema,
  window: z.strictObject({ from: utcTimestampSchema, to: utcTimestampSchema }),
  observationCount: z.number().int().nonnegative().max(2000),
  resultState: resultStateSchema,
});
export const responseMetaSchema = z.strictObject({
  dataMode: dataModeSchema,
  resultState: resultStateSchema,
  region: z.literal('greater-la'),
  bbox: bboxSchema,
  pollutant: pollutantSchema,
  measurementType: measurementTypeSchema,
  window: z.strictObject({ from: utcTimestampSchema, to: utcTimestampSchema }),
  fetchedAt: utcTimestampSchema,
  availableCoverage: z.strictObject({
    bbox: bboxSchema,
    window: z.strictObject({
      from: utcTimestampSchema,
      to: utcTimestampSchema,
    }),
  }),
  latestObservedAt: utcTimestampSchema.nullable(),
  delayed: z.boolean().nullable(),
  sourceId: sourceIdSchema,
  snapshotId: z.uuid().nullable(),
  persistenceError: errorCodeSchema.nullable(),
  diagnostics: diagnosticsSchema,
  cache: z.strictObject({
    status: z.enum(['miss', 'hit', 'coalesced', 'stale']),
    storedAt: utcTimestampSchema,
    expiresAt: utcTimestampSchema,
    staleReason: errorCodeSchema.nullable(),
  }),
  pagination: z.strictObject({
    limit: z.number().int(),
    offset: z.number().int(),
    total: z.number().int(),
    nextOffset: z.number().int().nullable(),
  }),
  warnings: z.array(
    z.enum([
      'stale-data',
      'snapshot-not-persisted',
      'missing-values',
      'rejected-rows',
      'conflicting-rows',
      'delayed-observations',
    ]),
  ),
});
export const stationsResponseSchema = z.strictObject({
  data: z.array(stationSchema),
  meta: responseMetaSchema,
});
export const observationsResponseSchema = z.strictObject({
  data: z.strictObject({
    station: stationSchema,
    observations: z.array(observationSchema),
  }),
  meta: responseMetaSchema,
});
export const regionsResponseSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      id: z.literal('greater-la'),
      name: z.string(),
      crs: z.literal('EPSG:4326'),
      bbox: bboxSchema,
    }),
  ),
});
export const productsResponseSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      id: z.literal('monitoring-stations'),
      product: z.literal('observation'),
      pollutants: z.array(pollutantSchema),
      measurementTypes: z.array(measurementTypeSchema),
      modes: z.strictObject({
        sample: z.literal('available'),
        historical: z.literal('identified-curated-snapshot-required'),
        live: z.literal('provider-contract-unverified'),
      }),
      maxWindowHours: z.literal(72),
    }),
  ),
});
export const dataSourceSchema = z.strictObject({
  id: sourceIdSchema,
  provider: providerSchema,
  label: z.string(),
  sourceReference: publicSourceReferenceSchema,
  verification: z.string(),
});
export const datasetsResponseSchema = z.strictObject({
  data: z.array(snapshotSchema).max(20),
  sources: z.array(dataSourceSchema),
  sampleFixture: z.strictObject({
    id: z.literal('synthetic-stations-v1'),
    label: z.string(),
    mode: z.literal('sample'),
    endAt: utcTimestampSchema,
  }),
  database: z.enum(['available', 'unavailable']),
  resultState: z.enum(['complete', 'partial']),
  warning: errorCodeSchema.nullable(),
});
const cacheCountersSchema = z.strictObject({
  hits: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  coalesced: z.number().int().nonnegative(),
  staleResponses: z.number().int().nonnegative(),
});
export const usageSummarySchema = z.strictObject({
  startedAt: utcTimestampSchema,
  scope: z.literal('since-process-start'),
  definitions: z.strictObject({
    requests: z.string(),
    latency: z.string(),
    cache: z.string(),
    hitRate: z.string(),
    exclusions: z.string(),
  }),
  providers: z.array(
    z.strictObject({
      provider: z.enum(['airnow', 'aqs']),
      requests: z.number().int().nonnegative(),
      successes: z.number().int().nonnegative(),
      failures: z.number().int().nonnegative(),
      totalLatencyMs: z.number().nonnegative(),
      averageLatencyMs: z.number().nonnegative().nullable(),
      cacheHits: z.number().int().nonnegative(),
      cacheMisses: z.number().int().nonnegative(),
      coalescedRequests: z.number().int().nonnegative(),
    }),
  ),
  cache: cacheCountersSchema.extend({
    hitRate: z.number().min(0).max(1).nullable(),
    byMode: z.strictObject({
      sample: cacheCountersSchema,
      historical: cacheCountersSchema,
      live: cacheCountersSchema,
    }),
  }),
  clientServices: z.array(
    z.strictObject({
      provider: z.literal('arcgis'),
      status: z.literal('not tracked locally'),
    }),
  ),
});
export type Station = z.infer<typeof stationSchema>;
export type StationIdentity = z.infer<typeof stationIdentitySchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SourceId = z.infer<typeof sourceIdSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ResponseMeta = z.infer<typeof responseMetaSchema>;
