import { useState } from 'react';
import { documentChunkSchema } from '@aq/contracts';
import type { z } from 'zod';
export function CorpusSources() {
  const [chunks, setChunks] = useState<
    z.infer<typeof documentChunkSchema>[] | null
  >(null);
  const [state, setState] = useState(
    'Open to inspect the local methodology corpus.',
  );
  async function load() {
    if (chunks) return;
    setState('Reading corpus…');
    try {
      const r = await fetch('/api/research/corpus', {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw Error();
      setChunks(
        documentChunkSchema
          .array()
          .max(16)
          .parse(await r.json()),
      );
      setState(
        'Methodology references only; not observation providers. Reviewed paraphrases, not complete publisher documents.',
      );
    } catch {
      setState('Methodology corpus unavailable. No remote fallback.');
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>Research Assistant methodology sources</summary>
      <p>{state}</p>
      {chunks &&
        [...new Set(chunks.map((c) => c.documentId))].map((id) => {
          const c = chunks.find((c) => c.documentId === id)!;
          return (
            <p key={id}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.title}
              </a>{' '}
              · {c.organization} · version {c.version ?? 'not supplied'} ·
              retrieved {c.retrievedAt}
            </p>
          );
        })}
    </details>
  );
}
