import { expect, it, vi } from 'vitest';
import { BatchCache } from '../../apps/api/src/bff/cache.js';
import { BffError } from '../../apps/api/src/bff/errors.js';
import { Usage } from '../../apps/api/src/bff/usage.js';
import { modeledBatch } from '../helpers/bff.js';

const value = () => ({
  batch: modeledBatch(),
  snapshotId: null,
  persistenceFailed: false,
});
it('expires by TTL, returns copies, and evicts bounded LRU entries', async () => {
  let time = 1000;
  const cache = new BatchCache(new Usage(), {
    ttlMs: 10,
    staleMs: 20,
    maxEntries: 1,
    now: () => time,
  });
  const load = vi.fn(async () => value());
  const first = await cache.get('a', 'sample', load);
  first.batch.stations[0]!.name = 'caller mutation';
  expect(
    (await cache.get('a', 'sample', load)).batch.stations[0]!.name,
  ).not.toBe('caller mutation');
  expect(load).toHaveBeenCalledOnce();
  time += 11;
  expect((await cache.get('a', 'sample', load)).cache.status).toBe('miss');
  await cache.get('b', 'sample', load);
  await cache.get('a', 'sample', load);
  expect(load).toHaveBeenCalledTimes(4);
});
it('coalesces concurrent loads and counts joined requests separately', async () => {
  const usage = new Usage();
  const cache = new BatchCache(usage, { ttlMs: 1000, staleMs: 1000 });
  const load = vi.fn(async () => value());
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => cache.get('same-key', 'sample', load)),
  );
  expect(load).toHaveBeenCalledOnce();
  expect(responses.filter((r) => r.cache.status === 'coalesced')).toHaveLength(
    19,
  );
  expect(usage.summary().cache).toMatchObject({
    hits: 0,
    misses: 1,
    coalesced: 19,
    hitRate: 0,
  });
  expect(
    usage
      .summary()
      .providers.every(
        (p) => p.requests === 0 && p.cacheHits === 0 && p.cacheMisses === 0,
      ),
  ).toBe(true);
});
it('serves explicit stale data only within the grace period, retaining original timestamps', async () => {
  let time = 1000;
  const usage = new Usage();
  const cache = new BatchCache(usage, {
    ttlMs: 10,
    staleMs: 20,
    now: () => time,
  });
  const first = await cache.get('key', 'sample', async () => value());
  time = 1011;
  const stale = await cache.get('key', 'sample', async () => {
    throw new BffError('UPSTREAM_SERVER_ERROR');
  });
  expect(stale.cache).toMatchObject({
    status: 'stale',
    staleReason: 'UPSTREAM_SERVER_ERROR',
    storedAt: first.cache.storedAt,
    expiresAt: first.cache.expiresAt,
  });
  expect(stale.batch.fetchedAt).toBe(first.batch.fetchedAt);
  time = 1030;
  await expect(
    cache.get('key', 'sample', async () => {
      throw new BffError('UPSTREAM_TIMEOUT');
    }),
  ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
  expect(usage.summary().cache.staleResponses).toBe(1);
});
it('bounds pending work and cached bytes without creating hidden loads', async () => {
  let release!: (payload: ReturnType<typeof value>) => void;
  const cache = new BatchCache(new Usage(), {
    ttlMs: 10,
    staleMs: 0,
    maxPending: 1,
  });
  const first = cache.get(
    'one',
    'sample',
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await expect(
    cache.get('two', 'sample', async () => value()),
  ).rejects.toMatchObject({ code: 'BUSY' });
  release(value());
  await first;
  const tiny = new BatchCache(new Usage(), {
    ttlMs: 10,
    staleMs: 0,
    maxBytes: 1,
  });
  await expect(
    tiny.get('oversized', 'sample', async () => value()),
  ).rejects.toMatchObject({ code: 'UPSTREAM_TOO_LARGE' });
});
