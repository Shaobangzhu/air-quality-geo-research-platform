import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  documentChunkSchema,
  documentEvidenceSchema,
  methodologyUrls,
} from '@aq/contracts';
export const corpusPath = new URL(
  '../../../../fixtures/methodology/corpus.json',
  import.meta.url,
);
export const indexPath = new URL(
  '../../../../fixtures/methodology/index.json',
  import.meta.url,
);
const sourceSchema = z.strictObject({
  id: z.string().regex(/^[a-z-]{1,40}$/),
  organization: z.string().max(80),
  title: z.string().max(120),
  url: z.enum(methodologyUrls),
  version: z.string().max(80).nullable(),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  reuse: z.string().min(30).max(600),
  sections: z
    .array(
      z.strictObject({
        section: z.string().min(1).max(160),
        topic: documentChunkSchema.shape.topic,
        text: z.string().min(20).max(1200),
      }),
    )
    .min(1)
    .max(8),
});
export const corpusSchema = z.strictObject({
  version: z.literal('methodology-v1'),
  reviewedAt: z.iso.datetime(),
  indexedAt: z.iso.datetime(),
  sources: z.array(sourceSchema).min(1).max(8),
});
export const sha = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const INDEX_VERSION = 'local-hash-tf-512-v1' as const;
const stop = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'is',
  'are',
  'in',
  'for',
  'with',
  'what',
  'how',
  'does',
  'can',
  'this',
  'that',
  'it',
  'as',
  'from',
]);
// Real local lexical feature vectors, not neural/OpenAI embeddings or mock vectors.
export function vector(text: string) {
  if (Buffer.byteLength(text) > 8000) throw Error('Text bound');
  const v = Array<number>(512).fill(0);
  for (const token of text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [])
    if (!stop.has(token)) {
      const i = parseInt(sha(token).slice(0, 8), 16) % 512;
      v[i] = v[i]! + 1;
    }
  const norm = Math.hypot(...v);
  return v.map((n) => (norm ? n / norm : 0));
}
export function buildIndex(raw: unknown) {
  const corpus = corpusSchema.parse(raw);
  const topics = new Set<string>();
  const chunks = corpus.sources.flatMap((s) =>
    s.sections.map((section) => {
      if (topics.has(section.topic))
        throw Error('Conflicting duplicate topic requires review');
      topics.add(section.topic);
      if (
        /https?:|sk-[a-z0-9]|api[_ -]?key|ignore.{0,30}instructions|system prompt|execute.{0,20}(sql|code)/i.test(
          section.text,
        )
      )
        throw Error('Unsafe source text requires review');
      const checksum = sha(section.text);
      const id =
        'doc_' +
        sha(JSON.stringify([s.id, s.version, section.section, checksum]));
      const chunk = documentChunkSchema.parse({
        id,
        documentId: s.id,
        organization: s.organization,
        title: s.title,
        url: s.url,
        version: s.version,
        publishedAt: s.publishedAt,
        retrievedAt: corpus.reviewedAt,
        indexedAt: corpus.indexedAt,
        section: section.section,
        page: null,
        topic: section.topic,
        checksum,
        text: section.text,
        representation: 'reviewed-paraphrase',
      });
      return { chunk, vector: vector(section.text + ' ' + section.section) };
    }),
  );
  return {
    version: INDEX_VERSION,
    provider: 'local-lexical',
    dimensions: 512,
    corpusHash: sha(JSON.stringify(corpus)),
    chunks,
  };
}
export function loadIndex() {
  const raw = readFileSync(corpusPath, 'utf8');
  const stored = readFileSync(indexPath, 'utf8');
  if (Buffer.byteLength(raw) > 32000 || Buffer.byteLength(stored) > 128000)
    throw Error('Corpus size bound');
  const expected = buildIndex(JSON.parse(raw));
  if (JSON.stringify(expected) !== JSON.stringify(JSON.parse(stored)))
    throw Error('Index drift; review and rebuild explicitly');
  return expected;
}
export function search(
  index: ReturnType<typeof buildIndex>,
  query: string,
  topK = 3,
) {
  if (!Number.isInteger(topK) || topK < 1 || topK > 3 || query.length > 200)
    throw Error('Retrieval bound');
  const q = vector(query);
  return index.chunks
    .map((entry) => ({
      ...entry,
      score: entry.vector.reduce((s, v, i) => s + v * q[i]!, 0),
    }))
    .filter((e) => e.score > 0.1)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, topK);
}
export function retrieve(
  topic: 'validity' | 'monitor' | 'aqi',
  index = loadIndex(),
  now = Date.now(),
) {
  const queries = {
    validity:
      'AirNow preliminary validation regulatory compliance certification AQS',
    monitor: 'AQS monitor identity site pollutant parameter POC',
    aqi: 'AQI index concentration physical units health categories',
  };
  const hits = search(index, queries[topic]).filter(
    (e) => e.chunk.topic === topic,
  );
  if (
    hits.length !== 1 ||
    hits.some(
      (e) =>
        e.chunk.checksum !== sha(e.chunk.text) ||
        now - Date.parse(e.chunk.retrievedAt) > 180 * 86400000 ||
        Date.parse(e.chunk.retrievedAt) > now + 86400000,
    )
  )
    throw Error('Missing, stale or conflicting methodology evidence');
  return documentEvidenceSchema.parse({
    indexVersion: INDEX_VERSION,
    corpusVersion: 'methodology-v1',
    chunks: hits.map((e) => e.chunk),
    citations: hits.map((e) => ({ type: 'document', id: e.chunk.id })),
  });
}

export function verifyDocumentEvidence(input: unknown) {
  const result = documentEvidenceSchema.parse(input);
  const canonical = loadIndex().chunks;
  if (
    result.chunks.some(
      (chunk) =>
        !canonical.some(
          (e) => JSON.stringify(e.chunk) === JSON.stringify(chunk),
        ),
    )
  )
    throw Error('Document evidence does not match reviewed manifest');
  return result;
}
