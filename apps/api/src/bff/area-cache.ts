import type { AreaBatch, AreaProductsResponse, DataMode } from '@aq/contracts';
import { BffError } from './errors.js';
import { Usage } from './usage.js';
type Cached = {
  batch: AreaBatch;
  cache: AreaProductsResponse['meta']['cache'];
};
export class AreaCache {
  private readonly entries = new Map<string, Cached>();
  private readonly pending = new Map<string, Promise<Cached>>();
  constructor(
    private readonly usage: Usage,
    private readonly now: () => number = Date.now,
  ) {}
  async get(
    key: string,
    mode: DataMode,
    ttlMs: number,
    load: () => Promise<AreaBatch>,
  ): Promise<Cached> {
    const stored = this.entries.get(key);
    if (stored && this.now() < Date.parse(stored.cache.expiresAt)) {
      this.usage.lookup(mode, 'hit');
      this.entries.delete(key);
      this.entries.set(key, stored);
      return {
        ...structuredClone(stored),
        cache: { ...structuredClone(stored.cache), status: 'hit' },
      };
    }
    const pending = this.pending.get(key);
    if (pending) {
      this.usage.lookup(mode, 'coalesced');
      const result = structuredClone(await pending);
      result.cache.status = 'coalesced';
      return result;
    }
    if (this.pending.size >= 4) throw new BffError('BUSY', 503, true);
    this.entries.delete(key);
    this.usage.lookup(mode, 'miss');
    const task = Promise.resolve().then(async () => {
      try {
        const batch = await load();
        const cached: Cached = {
          batch: structuredClone(batch),
          cache: {
            status: 'miss',
            storedAt: new Date(this.now()).toISOString(),
            expiresAt: new Date(this.now() + ttlMs).toISOString(),
          },
        };
        if (Buffer.byteLength(JSON.stringify(cached)) > 125_000)
          throw new BffError('UPSTREAM_TOO_LARGE', 502);
        while (this.entries.size >= 16) {
          const oldest = this.entries.keys().next().value;
          if (oldest === undefined) break;
          this.entries.delete(oldest);
        }
        this.entries.set(key, cached);
        return structuredClone(cached);
      } finally {
        this.pending.delete(key);
      }
    });
    this.pending.set(key, task);
    return task;
  }
}
