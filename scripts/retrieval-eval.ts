import { readFileSync } from 'node:fs';
import { loadIndex, search } from '../apps/api/src/retrieval/corpus.js';
import { z } from 'zod';
const suite = z
  .object({
    version: z.literal('retrieval-eval-v1'),
    cases: z
      .array(z.object({ question: z.string().max(200), topic: z.string() }))
      .max(30),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL('../fixtures/methodology/evaluation.json', import.meta.url),
        'utf8',
      ),
    ),
  );
const index = loadIndex();
const cases = suite.cases.map((c) => {
  const hits = search(index, c.question);
  return {
    question: c.question,
    expectedTopic: c.topic,
    top1: hits[0]?.chunk.topic === c.topic,
    hitAt3: hits.some((h) => h.chunk.topic === c.topic),
    chunkIds: hits.map((h) => h.chunk.id),
  };
});
console.log(
  JSON.stringify(
    {
      suite: suite.version,
      embedding: index.version,
      total: cases.length,
      top1: cases.filter((c) => c.top1).length,
      hitAt3: cases.filter((c) => c.hitAt3).length,
      cases,
      limitation:
        'Small curated lexical smoke set; not a general retrieval reliability estimate.',
    },
    null,
    2,
  ),
);
if (cases.some((c) => !c.hitAt3)) process.exitCode = 1;
