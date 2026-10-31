import { methodologyUrls } from '@aq/contracts';
import { sha } from './corpus.js';
export async function acquireSource(
  url: string,
  fetcher: typeof fetch = fetch,
) {
  if (!methodologyUrls.some((allowed) => allowed === url))
    throw Error('URL not allowlisted');
  const response = await fetcher(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'text/html' },
  });
  if (
    !response.ok ||
    !response.headers.get('content-type')?.startsWith('text/html') ||
    Number(response.headers.get('content-length')) > 500000
  )
    throw Error('Unsupported source response');
  if (!response.body) throw Error('Missing source body');
  const reader = response.body.getReader();
  let html = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 500000) throw Error('Source size bound');
      html += decoder.decode(part.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  html += decoder.decode();
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60000);
  return {
    text,
    metadata: {
      url,
      receivedAt: new Date().toISOString(),
      sourceSha256: sha(html),
      bytes,
      extraction:
        'HTML tag-stripped review copy; entities/navigation may remain; never automatically indexed',
    },
  };
}
