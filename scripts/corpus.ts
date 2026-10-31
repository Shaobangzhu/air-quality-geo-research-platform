import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  buildIndex,
  corpusPath,
  indexPath,
  corpusSchema,
} from '../apps/api/src/retrieval/corpus.js';
import { acquireSource } from '../apps/api/src/retrieval/acquisition.js';
const mode = process.argv[2];
try {
  if (
    process.argv.length !== 3 ||
    !['--build', '--check', '--fetch'].includes(mode ?? '')
  )
    throw Error();
  const raw = await readFile(corpusPath, 'utf8');
  if (Buffer.byteLength(raw) > 32000) throw Error();
  const corpus = corpusSchema.parse(JSON.parse(raw));
  if (mode === '--fetch') {
    const dir = new URL('../.local/corpus/', import.meta.url);
    await mkdir(dir, { recursive: true });
    for (const source of corpus.sources) {
      const acquired = await acquireSource(source.url);
      await writeFile(new URL(source.id + '.txt', dir), acquired.text);
      await writeFile(
        new URL(source.id + '.json', dir),
        JSON.stringify(acquired.metadata, null, 2) + '\n',
      );
    }
    console.log(
      'Fetched only curated URLs into ignored review copies. Review sections and update corpus metadata explicitly before rebuilding.',
    );
  } else {
    const built = JSON.stringify(buildIndex(corpus), null, 2) + '\n';
    if (mode === '--check') {
      if ((await readFile(indexPath, 'utf8')) !== built) throw Error();
    } else {
      let previous = '';
      try {
        previous = await readFile(indexPath, 'utf8');
      } catch {
        /* First build. */
      }
      if (previous !== built) await writeFile(indexPath, built);
    }
    console.log(
      `Corpus ${mode === '--check' ? 'verified' : 'indexed'}: ${corpus.sources.length} sources; local lexical vectors; no paid API.`,
    );
  }
} catch {
  console.error(
    'Corpus operation refused or source unavailable. No arbitrary URL/path import and no automatic source promotion.',
  );
  process.exitCode = 1;
}
