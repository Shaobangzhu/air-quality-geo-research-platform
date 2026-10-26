import { z } from 'zod';
import {
  dataModeSchema,
  pollutantSchema,
  regionIdSchema,
  utcTimestampSchema,
} from './domain.js';
export const areaProductIdSchema = z.enum(['reporting-area-aqi', 'forecast']);
export const dataProductIdSchema = z.enum([
  'monitoring-stations',
  'reporting-area-aqi',
  'forecast',
]);
export const areaIdSchema = z.string().regex(/^ra_[a-f0-9]{32}$/);
export const areaCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);
export const areaCategorySchema = z.enum([
  'Good',
  'Moderate',
  'Unhealthy for Sensitive Groups',
  'Unhealthy',
  'Very Unhealthy',
  'Hazardous',
]);
export function categoryForAreaAqi(aqi: number) {
  return aqi <= 50
    ? 'Good'
    : aqi <= 100
      ? 'Moderate'
      : aqi <= 150
        ? 'Unhealthy for Sensitive Groups'
        : aqi <= 200
          ? 'Unhealthy'
          : aqi <= 300
            ? 'Very Unhealthy'
            : 'Hazardous';
}
export const reportingAreaIdentitySchema = z.strictObject({
  id: areaIdSchema,
  provider: z.enum(['synthetic', 'airnow']),
  code: areaCodeSchema,
  name: z.string().min(1).max(160),
  geometry: z.null(), // No verified official centroid/geometry contract is implemented.
});
const fields = {
  area: reportingAreaIdentitySchema,
  pollutant: pollutantSchema,
  aqi: z.number().int().nonnegative().nullable(),
  category: areaCategorySchema.nullable(),
  sourceCategory: z.strictObject({
    code: z.string().max(32).nullable(),
    label: z.string().max(160).nullable(),
  }),
  reportingAgency: z.string().min(1).max(200),
  fetchedAt: utcTimestampSchema,
};
export const areaCurrentAqiSchema = z.strictObject({
  ...fields,
  product: z.literal('reporting-area-current-aqi'),
  observedAt: utcTimestampSchema.nullable(),
  reportedTimeDescription: z.string().min(1).max(300),
  aggregation: z.literal('reporting-area-aggregate'),
  dataStatus: z.enum(['preliminary', 'unknown']),
});
export const areaForecastSchema = z.strictObject({
  ...fields,
  product: z.literal('reporting-area-forecast'),
  issuedAt: utcTimestampSchema.nullable(),
  status: z.literal('prediction'),
  validity: z.discriminatedUnion('precision', [
    z.strictObject({
      precision: z.literal('date'),
      date: z.iso.date(),
      sourceTimeZone: z.string().min(1).max(100).nullable(),
    }),
    z.strictObject({
      precision: z.literal('instant-window'),
      from: utcTimestampSchema,
      to: utcTimestampSchema,
      sourceTimeZone: z.string().min(1).max(100).nullable(),
    }),
  ]),
});
export const areaRecordSchema = z.discriminatedUnion('product', [
  areaCurrentAqiSchema,
  areaForecastSchema,
]);
const areaSourceReferenceSchema = z
  .string()
  .min(1)
  .max(350)
  .refine((value) => {
    if (value === 'fixture:area-products-v1') return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.hostname === 'docs.airnowapi.org' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  });
export const areaSourceSchema = z.strictObject({
  provider: z.enum(['synthetic', 'airnow']),
  origin: z.enum(['synthetic', 'provider-live', 'official-historical']),
  label: z.string().min(1).max(160),
  reference: areaSourceReferenceSchema,
});
export const areaBatchSchema = z
  .strictObject({
    product: areaProductIdSchema,
    dataMode: dataModeSchema,
    region: regionIdSchema,
    scope: z.enum([
      'synthetic-fixture-declaration',
      'reviewed-regional-area-code',
    ]),
    fetchedAt: utcTimestampSchema,
    archiveId: z.uuid().nullable(),
    source: areaSourceSchema,
    records: z.array(areaRecordSchema).max(40),
  })
  .superRefine((batch, ctx) => {
    const issue = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid reporting-area product semantics.',
      });
    const sample = batch.dataMode === 'sample';
    if (
      sample
        ? batch.source.provider !== 'synthetic' ||
          batch.source.origin !== 'synthetic' ||
          !batch.source.label.startsWith('SYNTHETIC SAMPLE') ||
          batch.source.reference !== 'fixture:area-products-v1' ||
          batch.scope !== 'synthetic-fixture-declaration'
        : batch.source.provider !== 'airnow' ||
          batch.source.origin !==
            (batch.dataMode === 'live'
              ? 'provider-live'
              : 'official-historical') ||
          batch.source.reference === 'fixture:area-products-v1' ||
          batch.scope !== 'reviewed-regional-area-code'
    )
      issue();
    if ((batch.dataMode === 'historical') !== (batch.archiveId !== null))
      issue();
    const identities = new Map<string, string>();
    const codes = new Map<string, string>();
    const revisions = new Set<string>();
    for (const row of batch.records) {
      if (
        row.area.provider !== batch.source.provider ||
        sample !== row.area.code.startsWith('SAMPLE-') ||
        Date.parse(row.fetchedAt) !== Date.parse(batch.fetchedAt) ||
        row.product !==
          (batch.product === 'reporting-area-aqi'
            ? 'reporting-area-current-aqi'
            : 'reporting-area-forecast')
      )
        issue();
      if (
        row.aqi !== null &&
        row.category !== null &&
        categoryForAreaAqi(row.aqi) !== row.category
      )
        issue();
      if (
        row.product === 'reporting-area-current-aqi' &&
        row.observedAt &&
        Date.parse(row.observedAt) > Date.parse(row.fetchedAt)
      )
        issue();
      if (
        row.product === 'reporting-area-forecast' &&
        row.issuedAt &&
        Date.parse(row.issuedAt) > Date.parse(row.fetchedAt)
      )
        issue();
      const identity = JSON.stringify(row.area);
      if (
        (identities.has(row.area.id) &&
          identities.get(row.area.id) !== identity) ||
        (codes.has(row.area.code) && codes.get(row.area.code) !== row.area.id)
      )
        issue();
      identities.set(row.area.id, identity);
      codes.set(row.area.code, row.area.id);
      if (
        row.product === 'reporting-area-forecast' &&
        row.validity.precision === 'instant-window' &&
        Date.parse(row.validity.from) >= Date.parse(row.validity.to)
      )
        issue();
      const revision = JSON.stringify(row);
      if (revisions.has(revision)) issue();
      revisions.add(revision);
    }
    if (identities.size > 10) issue();
  });
export const areaProductsResponseSchema = z
  .strictObject({
    data: z.array(areaRecordSchema).max(20),
    meta: z.strictObject({
      product: areaProductIdSchema,
      dataMode: dataModeSchema,
      region: regionIdSchema,
      scope: z.enum([
        'synthetic-fixture-declaration',
        'reviewed-regional-area-code',
      ]),
      fetchedAt: utcTimestampSchema,
      archiveId: z.uuid().nullable(),
      source: areaSourceSchema,
      pollutant: pollutantSchema,
      resultState: z.enum(['complete', 'empty']),
      geometryStatus: z.literal('not-verified-no-symbols'),
      cache: z.strictObject({
        status: z.enum(['miss', 'hit', 'coalesced']),
        storedAt: utcTimestampSchema,
        expiresAt: utcTimestampSchema,
      }),
      pagination: z.strictObject({
        limit: z.number().int().min(1).max(20),
        offset: z.number().int().min(0).max(39),
        total: z.number().int().min(0).max(40),
        nextOffset: z.number().int().nullable(),
      }),
    }),
  })
  .superRefine(({ data, meta }, ctx) => {
    // Validate the exact batch fields rather than allowing response-only keys into a strict source schema.
    const { product, dataMode, region, scope, fetchedAt, archiveId, source } =
      meta;
    if (
      !areaBatchSchema.safeParse({
        product,
        dataMode,
        region,
        scope,
        fetchedAt,
        archiveId,
        source,
        records: data,
      }).success ||
      data.some((row) => row.pollutant !== meta.pollutant) ||
      (data.length === 0) !== (meta.resultState === 'empty')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Area result does not match its requested product.',
      });
  });
export const areaProductCapabilitySchema = z.strictObject({
  id: areaProductIdSchema,
  product: z.enum(['reporting-area-current-aqi', 'reporting-area-forecast']),
  pollutants: z.array(pollutantSchema),
  measurementTypes: z.array(z.literal('aqi')),
  modes: z.strictObject({
    sample: z.literal('synthetic-only'),
    historical: z.literal('archive-not-implemented'),
    live: z.literal('provider-contract-unverified'),
  }),
  geometry: z.literal('not-verified'),
  evidenceLevel: z.literal('capability-only'),
});
export const AREA_PRODUCT_CAPABILITIES = [
  {
    id: 'reporting-area-aqi',
    product: 'reporting-area-current-aqi',
    pollutants: ['PM2.5', 'O3'],
    measurementTypes: ['aqi'],
    modes: {
      sample: 'synthetic-only',
      historical: 'archive-not-implemented',
      live: 'provider-contract-unverified',
    },
    geometry: 'not-verified',
    evidenceLevel: 'capability-only',
  },
  {
    id: 'forecast',
    product: 'reporting-area-forecast',
    pollutants: ['PM2.5', 'O3'],
    measurementTypes: ['aqi'],
    modes: {
      sample: 'synthetic-only',
      historical: 'archive-not-implemented',
      live: 'provider-contract-unverified',
    },
    geometry: 'not-verified',
    evidenceLevel: 'capability-only',
  },
] satisfies z.infer<typeof areaProductCapabilitySchema>[];
export type AreaBatch = z.infer<typeof areaBatchSchema>;
export type AreaRecord = z.infer<typeof areaRecordSchema>;
export type AreaProductId = z.infer<typeof areaProductIdSchema>;
export type AreaProductsResponse = z.infer<typeof areaProductsResponseSchema>;
