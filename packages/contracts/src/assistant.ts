import { z } from 'zod';
import { documentEvidenceSchema } from './documents.js';
import {
  analysisSeriesResponseSchema,
  analysisWindowSchema,
} from './series.js';
import { stationIdSchema, measurementTypeSchema } from './bff.js';
import {
  regionIdSchema,
  pollutantSchema,
  dataModeSchema,
  utcTimestampSchema,
} from './domain.js';

export const researchQuestions = {
  summary: 'Summarize the selected station observations.',
  missingness: 'Which selected observations are missing or stale?',
  comparison: 'Compare the selected station ranges and coverage.',
  methodology: 'Can AirNow preliminary data establish regulatory compliance?',
  monitor: 'What identifies an AQS monitor?',
  aqi: 'How does AQI differ from concentration?',
  combined:
    'Summarize selected observations and explain the preliminary-data limitation.',
} as const;
export const researchIntentSchema = z.enum([
  'summary',
  'missingness',
  'comparison',
  'methodology',
  'monitor',
  'aqi',
  'combined',
]);
export const researchContextSchema = z.strictObject({
  region: regionIdSchema,
  pollutant: pollutantSchema,
  measurementType: measurementTypeSchema,
  mode: dataModeSchema,
  windowHours: analysisWindowSchema,
  endAt: utcTimestampSchema.refine((v) => Date.parse(v) % 3600000 === 0),
  snapshotId: z.uuid().optional(),
  stationIds: z
    .array(stationIdSchema)
    .min(1)
    .max(3)
    .refine((v) => new Set(v).size === v.length),
});
export const researchRequestSchema = z.strictObject({
  question: z.string().min(1).max(200),
  context: researchContextSchema,
});
export const researchAnswerSchema = z
  .strictObject({
    question: z.string().max(200),
    status: z.enum([
      'grounded',
      'partial',
      'insufficient',
      'unsupported',
      'disabled',
      'unavailable',
    ]),
    shortAnswer: z.enum([
      'Verified station ranges and coverage are shown below.',
      'Missingness and cache freshness are shown below; missing is not zero.',
      'Compare only the compatible station ranges below; no regional AQI is calculated.',
      'Insufficient evidence for this selection.',
      'This question or data mode is outside the supported research scope.',
      'Research Assistant is disabled. Configure it on the local server.',
      'Research Assistant could not verify an answer. Try again later.',
      'Reviewed methodology is cited below; it does not certify measurements.',
      'Selected observations and independent methodology evidence are shown below.',
    ]),
    generatedAt: utcTimestampSchema,
    evidence: analysisSeriesResponseSchema.nullable(),
    documents: documentEvidenceSchema.optional(),
    citations: z
      .array(z.strictObject({ type: z.literal('data'), id: stationIdSchema }))
      .max(3),
    limitations: z.array(z.string().max(300)).max(8),
  })
  .superRefine((v, ctx) => {
    const ids = v.evidence?.series.map((s) => s.station.id) ?? [];
    if (
      new Set(v.citations.map((c) => c.id)).size !== v.citations.length ||
      v.citations.some((c) => !ids.includes(c.id)) ||
      (v.evidence &&
        (ids.length !== v.citations.length ||
          !['grounded', 'partial', 'insufficient'].includes(v.status))) ||
      (['grounded', 'partial'].includes(v.status) &&
        !v.evidence &&
        !v.documents?.chunks.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Unresolved evidence citations.',
      });
  });
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchAnswer = z.infer<typeof researchAnswerSchema>;
