import { z } from 'zod';

export const coordinateSchema = z.strictObject({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export const bboxSchema = z
  .strictObject({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .refine((b) => b.west < b.east && b.south < b.north, {
    message:
      'Expected west < east and south < north; no antimeridian crossing.',
  });
export const GREATER_LA = Object.freeze({
  id: 'greater-la',
  name: 'Greater LA study extent',
  crs: 'EPSG:4326',
  bbox: Object.freeze(
    bboxSchema.parse({
      west: -119.05,
      south: 33.35,
      east: -116.7,
      north: 34.6,
    }),
  ),
});
export const regionIdSchema = z.enum([
  'greater-la',
  'coastal-la',
  'inland-empire',
]);
// Rectangular engineering presets inside the parent study extent, not legal/basin boundaries.
export const STUDY_REGIONS = Object.freeze([
  GREATER_LA,
  Object.freeze({
    id: 'coastal-la' as const,
    name: 'Coastal LA',
    crs: 'EPSG:4326' as const,
    bbox: Object.freeze(
      bboxSchema.parse({
        west: -118.65,
        south: 33.65,
        east: -118.1,
        north: 34.15,
      }),
    ),
  }),
  Object.freeze({
    id: 'inland-empire' as const,
    name: 'Inland Empire',
    crs: 'EPSG:4326' as const,
    bbox: Object.freeze(
      bboxSchema.parse({
        west: -117.85,
        south: 33.75,
        east: -116.7,
        north: 34.35,
      }),
    ),
  }),
]);
export function selectStudyRegion(id: string) {
  const valid = regionIdSchema.parse(id);
  return STUDY_REGIONS.find((region) => region.id === valid)!;
}
export function isWithinStudyExtent(
  point: z.infer<typeof coordinateSchema>,
): boolean {
  const p = coordinateSchema.parse(point);
  const b = GREATER_LA.bbox;
  return (
    p.longitude >= b.west &&
    p.longitude <= b.east &&
    p.latitude >= b.south &&
    p.latitude <= b.north
  );
}

export const pollutantSchema = z.enum(['PM2.5', 'O3', 'PM10']);
export const dataModeSchema = z.enum(['live', 'historical', 'sample']);
export const validationStatusSchema = z.enum([
  'preliminary',
  'validated',
  'unknown',
]);
export const utcTimestampSchema = z.iso.datetime({ offset: false });

// Internal normalized measurements. No conversion or AQI calculation is implied.
export const measurementSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('aqi'),
    pollutant: pollutantSchema,
    value: z.number().int().nonnegative().nullable(),
    unit: z.literal('AQI'),
  }),
  z
    .strictObject({
      kind: z.literal('concentration'),
      pollutant: pollutantSchema,
      value: z.number().nullable(),
      unit: z.enum(['µg/m³', 'ppm', 'ppb']),
    })
    .refine(
      (m) =>
        m.pollutant === 'O3'
          ? m.unit === 'ppm' || m.unit === 'ppb'
          : m.unit === 'µg/m³',
      { message: 'Unit must match pollutant.' },
    ),
]);
export const rawMeasurementSchema = z.strictObject({
  value: z.number().nullable(),
  unit: z.string().min(1),
  parameter: z.string().min(1),
  // Preserve provider flags separately; null means no flag was supplied.
  qualifier: z.string().nullable(),
});
export const provenanceSchema = z.strictObject({
  provider: z.string().min(1),
  source: z.string().min(1), // Credential-free source identifier, never a signed request URL.
  origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
  label: z.string().min(1),
  fetchedAt: utcTimestampSchema,
});
export const periodSchema = z
  .strictObject({
    meaning: z.enum(['hourly', 'daily', 'nowcast', 'unknown']),
    averagingDescription: z.string().min(1),
    sourceTimeZone: z.string().min(1), // Can record fixed LST as well as an IANA zone.
    startsAt: utcTimestampSchema.nullable(),
    endsAt: utcTimestampSchema.nullable(),
  })
  .refine(
    (p) =>
      p.startsAt === null ||
      p.endsAt === null ||
      Date.parse(p.startsAt) < Date.parse(p.endsAt),
    {
      message: 'Period end must follow start.',
    },
  );
export const monitoringSiteSchema = z.strictObject({
  kind: z.literal('monitoring-site'),
  id: z.string().min(1),
  name: z.string().min(1),
  coordinate: coordinateSchema,
});
export const reportingAreaSchema = z.strictObject({
  kind: z.literal('reporting-area'),
  code: z.string().min(1),
  name: z.string().min(1),
  representativeCoordinate: coordinateSchema.nullable(),
});
const observationFields = {
  product: z.literal('observation'),
  observedAt: utcTimestampSchema,
  period: periodSchema,
  measurement: measurementSchema,
  raw: rawMeasurementSchema,
  validationStatus: validationStatusSchema,
  provenance: provenanceSchema,
};
export const siteObservationSchema = z.strictObject({
  ...observationFields,
  site: monitoringSiteSchema,
});
export const reportingAreaObservationSchema = z.strictObject({
  ...observationFields,
  area: reportingAreaSchema,
});
export const forecastSchema = z
  .strictObject({
    product: z.literal('forecast'),
    area: reportingAreaSchema,
    issuedAt: utcTimestampSchema.nullable(),
    validFrom: utcTimestampSchema,
    validTo: utcTimestampSchema,
    period: periodSchema,
    measurement: measurementSchema,
    provenance: provenanceSchema,
  })
  .refine((f) => Date.parse(f.validFrom) < Date.parse(f.validTo), {
    message: 'Forecast validity must be ordered.',
  });
export const contourSchema = z.strictObject({
  product: z.literal('contours'),
  surface: z.enum(['official-contour', 'derived-surface']),
  pollutant: pollutantSchema,
  validAt: utcTimestampSchema,
  bbox: bboxSchema,
  artifactReference: z.string().min(1),
  provenance: provenanceSchema,
});
export const sampleFixtureSchema = z
  .strictObject({
    mode: z.literal('sample'),
    label: z.string().startsWith('SYNTHETIC SAMPLE'),
    observations: z.array(siteObservationSchema).min(1),
  })
  .superRefine((fixture, ctx) => {
    fixture.observations.forEach((row, index) => {
      if (
        !row.site.id.startsWith('SAMPLE-') ||
        row.provenance.origin !== 'synthetic' ||
        !row.provenance.label.startsWith('SYNTHETIC SAMPLE')
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['observations', index],
          message:
            'Samples require fictional SAMPLE- IDs and explicit synthetic provenance.',
        });
      }
    });
  });
// Unavailable is an explicit state within a requested mode, never a fourth mode.
export const dataAvailabilitySchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('available'),
    mode: dataModeSchema,
    label: z.string().min(1),
  }),
  z.strictObject({
    state: z.literal('unavailable'),
    mode: dataModeSchema,
    reason: z.enum([
      'foundation-only',
      'api-unreachable',
      'snapshot-required',
      'provider-contract-unverified',
      'provider-not-configured',
    ]),
  }),
]);
export const databaseStatusSchema = z.enum([
  'connected',
  'unavailable',
  'not-configured',
]);
export const healthSchema = z.strictObject({
  service: z.literal('aq-research-api'),
  status: z.literal('ok'),
  database: databaseStatusSchema,
  data: dataAvailabilitySchema,
});
export type DataMode = z.infer<typeof dataModeSchema>;
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;
export type Health = z.infer<typeof healthSchema>;
export type SiteObservation = z.infer<typeof siteObservationSchema>;
