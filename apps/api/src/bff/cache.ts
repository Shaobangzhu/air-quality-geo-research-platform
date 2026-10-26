import type { Batch, DataMode, ErrorCode } from '@aq/contracts';
import { BffError, safeError } from './errors.js';
import { Usage } from './usage.js';

export type CachedBatch = {
  batch: Batch;
  snapshotId: string | null;
  persistenceFailed: boolean;
  persistenceError?: ErrorCode;
};
type Entry = {
  value: CachedBatch;
  storedAt: number;
  expiresAt: number;
  bytes: number;
};
export type CacheResult = CachedBatch & {
  cache: {
    status: 'miss' | 'hit' | 'coalesced' | 'stale';
    storedAt: string;
    expiresAt: string;
    staleReason: ErrorCode | null;
  };
};
export class BatchCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<CacheResult>>();
  private bytes = 0;
  constructor(
    private readonly usage: Usage,
    private readonly options: {
      ttlMs: number;
      staleMs: number;
      maxEntries?: number;
      maxBytes?: number;
      maxPending?: number;
      now?: () => number;
    },
  ) {}
  private now() {
    return (this.options.now ?? Date.now)();
  }
  private view(
    entry: Entry,
    status: CacheResult['cache']['status'],
    staleReason: ErrorCode | null = null,
  ): CacheResult {
    return structuredClone({
      ...entry.value,
      cache: {
        status,
        storedAt: new Date(entry.storedAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        staleReason,
      },
    });
  }
  async get(
    key: string,
    mode: DataMode,
    load: () => Promise<CachedBatch>,
  ): Promise<CacheResult> {
    const existing = this.entries.get(key);
    if (existing && this.now() < existing.expiresAt) {
      this.usage.lookup(mode, 'hit');
      this.entries.delete(key);
      this.entries.set(key, existing);
      return this.view(existing, 'hit');
    }
    const pending = this.pending.get(key);
    if (pending) {
      this.usage.lookup(mode, 'coalesced');
      const result = structuredClone(await pending);
      if (result.cache.status !== 'stale') result.cache.status = 'coalesced';
      else this.usage.stale(mode);
      return result;
    }
    if (this.pending.size >= (this.options.maxPending ?? 4))
      throw new BffError('BUSY', 503, true);
    this.usage.lookup(mode, 'miss');
    const task = Promise.resolve().then(async () => {
      try {
        const value = await load();
        const bytes = Buffer.byteLength(JSON.stringify(value));
        if (bytes > (this.options.maxBytes ?? 8_000_000))
          throw new BffError('UPSTREAM_TOO_LARGE', 502);
        const entry: Entry = {
          value: structuredClone(value),
          storedAt: this.now(),
          expiresAt: this.now() + this.options.ttlMs,
          bytes,
        };
        if (existing) {
          this.entries.delete(key);
          this.bytes -= existing.bytes;
        }
        while (
          this.entries.size >= (this.options.maxEntries ?? 32) ||
          this.bytes + bytes > (this.options.maxBytes ?? 8_000_000)
        ) {
          const oldest = this.entries.entries().next().value;
          if (!oldest) break;
          this.entries.delete(oldest[0]);
          this.bytes -= oldest[1].bytes;
        }
        this.entries.set(key, entry);
        this.bytes += bytes;
        return this.view(entry, 'miss');
      } catch (error) {
        const failure = safeError(error);
        if (
          existing &&
          this.now() < existing.expiresAt + this.options.staleMs
        ) {
          this.usage.stale(mode);
          return this.view(existing, 'stale', failure.code);
        }
        if (existing && this.entries.delete(key)) this.bytes -= existing.bytes;
        throw failure;
      } finally {
        this.pending.delete(key);
      }
    });
    this.pending.set(key, task);
    return task;
  }
}
