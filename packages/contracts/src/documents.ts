import { z } from 'zod';
import { utcTimestampSchema } from './domain.js';
export const methodologyUrls = [
  'https://www.airnow.gov/about-the-data/',
  'https://aqs.epa.gov/aqsweb/airdata/FileFormats.html',
  'https://www.airnow.gov/aqi/aqi-basics/',
] as const;
export const documentChunkSchema = z.strictObject({
  id: z.string().regex(/^doc_[a-f0-9]{64}$/),
  documentId: z.string().max(40),
  organization: z.string().max(80),
  title: z.string().max(120),
  url: z.enum(methodologyUrls),
  version: z.string().max(80).nullable(),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  retrievedAt: utcTimestampSchema,
  indexedAt: utcTimestampSchema,
  section: z.string().max(160),
  page: z.null(),
  topic: z.enum(['validity', 'latency', 'monitor', 'standards', 'aqi']),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  text: z.string().min(20).max(1200),
  representation: z.literal('reviewed-paraphrase'),
});
export const documentEvidenceSchema = z
  .strictObject({
    indexVersion: z.literal('local-hash-tf-512-v1'),
    corpusVersion: z.literal('methodology-v1'),
    chunks: z.array(documentChunkSchema).max(3),
    citations: z
      .array(
        z.strictObject({
          type: z.literal('document'),
          id: z.string().regex(/^doc_[a-f0-9]{64}$/),
        }),
      )
      .max(3),
  })
  .superRefine((v, ctx) => {
    const ids = v.chunks.map((c) => c.id);
    if (
      new Set(ids).size !== ids.length ||
      v.citations.length !== ids.length ||
      new Set(v.citations.map((c) => c.id)).size !== ids.length ||
      v.citations.some((c) => !ids.includes(c.id))
    )
      ctx.addIssue({ code: 'custom', message: 'Unresolved document citation' });
  });
export type DocumentEvidence = z.infer<typeof documentEvidenceSchema>;
