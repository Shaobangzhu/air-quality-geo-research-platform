import { z } from 'zod';
import { bboxSchema, utcTimestampSchema } from './domain.js';
import { batchSchema } from './bff.js';
const publicUrl = z.url().refine((value) => {
  const u = new URL(value);
  return (
    u.protocol === 'https:' &&
    !u.username &&
    !u.password &&
    !u.search &&
    !u.hash &&
    [
      'www.fire.ca.gov',
      'osfm.fire.ca.gov',
      'services1.arcgis.com',
      'aqs.epa.gov',
      'www.epa.gov',
    ].includes(u.hostname)
  );
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const caseSourceSchema = z.strictObject({
  id: z.enum(['perimeter', 'sra', 'lra', 'observations']),
  version: z.string().min(1).max(150),
  released: z.string().min(4).max(50),
  effective: z.iso.date().nullable(),
  originalUrl: publicUrl,
  retrievedAt: utcTimestampSchema,
  artifact: z.enum([
    'perimeter.geojson',
    'sra.geojson',
    'lra.geojson',
    'epa-rows.json',
  ]),
  sha256: digest,
  downloadSha256: digest,
  attribution: z.string().min(1).max(200),
  limitations: z.string().min(1).max(500),
});
export const wildfireManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.literal('eaton-fire-2025'),
    title: z.literal('2025 Eaton Fire'),
    mode: z.literal('historical'),
    event: z.strictObject({
      started: z.literal('2025-01-07'),
      contained: z.literal('2025-01-31'),
      incidentId: z.literal('00009087'),
      irwinId: z.literal('72660ADC-B5EF-4D96-A33F-B4EA3740A4E3'),
      source: publicUrl,
      location: z.string().max(200),
    }),
    studyWindow: z.strictObject({
      from: utcTimestampSchema,
      to: utcTimestampSchema,
    }),
    bbox: bboxSchema,
    retrievedAt: utcTimestampSchema,
    sources: z.array(caseSourceSchema).length(4),
    observationArtifactSha256: digest,
    limitations: z.array(z.string().min(1).max(600)).min(1).max(15),
    optional: z.strictObject({
      scene: z.literal('unavailable'),
      contours: z.literal('unverified'),
      smoke: z.literal('unverified'),
    }),
  })
  .superRefine((m, ctx) => {
    if (
      new Set(m.sources.map((s) => s.id)).size !== 4 ||
      m.studyWindow.from >= m.studyWindow.to ||
      Date.parse(m.studyWindow.to) - Date.parse(m.studyWindow.from) >
        72 * 3600000
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Unique sources and a bounded ordered study window required.',
      });
    if (
      m.sources.find((s) => s.id === 'sra')?.effective !== '2024-04-01' ||
      m.sources.find((s) => s.id === 'lra')?.effective !== null
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Preserve SRA effective date and unknown local adoption.',
      });
  });
const point = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const ring = z
  .array(point)
  .min(4)
  .max(30000)
  .refine(
    (r) => r[0]![0] === r.at(-1)![0] && r[0]![1] === r.at(-1)![1],
    'Polygon rings must close.',
  );
export const caseGeometrySchema = z.strictObject({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(ring).min(1).max(300)).min(1).max(300),
});
export const caseFeatureSchema = z.strictObject({
  id: z.string().min(1).max(70),
  layer: z.enum(['perimeter', 'sra', 'lra']),
  category: z.enum(['Moderate', 'High', 'Very High']).nullable(),
  sourceObjectId: z.number().int(),
  geometry: caseGeometrySchema,
});
export const wildfireCaseSchema = z
  .strictObject({
    manifest: wildfireManifestSchema,
    layers: z.array(caseFeatureSchema).min(3).max(150),
    batch: batchSchema,
  })
  .superRefine((c, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (
      c.batch.dataMode !== 'historical' ||
      c.batch.sourceId !== 'epa-aqs' ||
      JSON.stringify(c.batch.window) !== JSON.stringify(c.manifest.studyWindow)
    )
      bad('Historical case and observation window must agree.');
    if (c.batch.observations.length === 0 || c.batch.diagnostics.rejectedRows)
      bad('Verified observations required.');
    if (new Set(c.layers.map((f) => f.id)).size !== c.layers.length)
      bad('Duplicate feature identity.');
    let count = 0;
    for (const f of c.layers) {
      if ((f.layer === 'perimeter') !== (f.category === null))
        bad('Hazard category belongs only to SRA/LRA.');
      for (const polygon of f.geometry.coordinates)
        for (const ring of polygon) {
          count += ring.length;
          for (const [x, y] of ring) {
            const b = c.manifest.bbox;
            if (
              x < b.west - 1e-8 ||
              x > b.east + 1e-8 ||
              y < b.south - 1e-8 ||
              y > b.north + 1e-8
            )
              bad('Geometry outside bounded case.');
          }
        }
    }
    if (count > 60000) bad('Geometry vertex budget exceeded.');
  });
export type WildfireCase = z.infer<typeof wildfireCaseSchema>;
export type CaseFeature = z.infer<typeof caseFeatureSchema>;
export const HAZARD_NOTICE =
  'Long-term hazard, not immediate fire risk, smoke, damage or evacuation guidance. Unmapped is not Low.';
