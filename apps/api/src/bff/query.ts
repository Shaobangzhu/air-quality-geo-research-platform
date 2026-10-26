import { z } from 'zod';
import {
  GREATER_LA,
  bboxSchema,
  dataModeSchema,
  measurementTypeSchema,
  pollutantSchema,
  utcTimestampSchema,
} from '@aq/contracts';
import { BffError } from './errors.js';

const integer = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const boundedBbox = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?){3}$/)
  .transform((value) => {
    const [west, south, east, north] = value.split(',').map(Number);
    return { west, south, east, north };
  })
  .pipe(bboxSchema)
  .refine(
    (b) =>
      b.west >= GREATER_LA.bbox.west &&
      b.east <= GREATER_LA.bbox.east &&
      b.south >= GREATER_LA.bbox.south &&
      b.north <= GREATER_LA.bbox.north,
  );
export const stationQuerySchema = z.strictObject({
  region: z.literal('greater-la').default('greater-la'),
  pollutant: pollutantSchema.default('PM2.5'),
  measurementType: measurementTypeSchema.default('concentration'),
  mode: dataModeSchema.optional(),
  windowHours: integer(1, 72).default(24),
  endAt: utcTimestampSchema
    .refine(
      (date) =>
        Date.parse(date) % 3_600_000 === 0 &&
        Date.parse(date) >= Date.parse('1970-01-01T00:00:00Z') &&
        Date.parse(date) < Date.parse('2101-01-01T00:00:00Z'),
    )
    .transform((value) => new Date(value).toISOString())
    .optional(),
  snapshotId: z.uuid().optional(),
  bbox: boundedBbox.optional(),
  limit: integer(1, 500).default(200),
  offset: integer(0, 1999).default(0),
});
export const datasetsQuerySchema = z.strictObject({
  mode: dataModeSchema.optional(),
  limit: integer(1, 20).default(20),
  offset: integer(0, 31).default(0),
});
export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BffError('INVALID_REQUEST', 400);
  return result.data;
}
export type StationQuery = z.infer<typeof stationQuerySchema>;
export type ProviderQuery = {
  region: 'greater-la';
  bbox: z.infer<typeof bboxSchema>;
  from: string;
  to: string;
  pollutant: z.infer<typeof pollutantSchema>;
  measurementType: 'aqi' | 'concentration';
};
