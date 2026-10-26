import type { DataMode } from '@aq/contracts';

type Provider = 'airnow' | 'aqs';
type Counters = {
  requests: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  coalescedRequests: number;
};
const counters = (): Counters => ({
  requests: 0,
  successes: 0,
  failures: 0,
  totalLatencyMs: 0,
  cacheHits: 0,
  cacheMisses: 0,
  coalescedRequests: 0,
});
export class Usage {
  readonly startedAt: string;
  private readonly providers = { airnow: counters(), aqs: counters() };
  private readonly modes = {
    sample: { hits: 0, misses: 0, coalesced: 0, staleResponses: 0 },
    historical: { hits: 0, misses: 0, coalesced: 0, staleResponses: 0 },
    live: { hits: 0, misses: 0, coalesced: 0, staleResponses: 0 },
  };
  constructor(now: () => number = Date.now) {
    this.startedAt = new Date(now()).toISOString();
  }
  attempt(provider: Provider, success: boolean, latencyMs: number) {
    const metric = this.providers[provider];
    metric.requests++;
    metric[success ? 'successes' : 'failures']++;
    metric.totalLatencyMs += Math.max(0, latencyMs);
  }
  lookup(mode: DataMode, outcome: 'hit' | 'miss' | 'coalesced') {
    const counters = this.modes[mode];
    counters[
      outcome === 'hit' ? 'hits' : outcome === 'miss' ? 'misses' : 'coalesced'
    ]++;
    if (mode === 'live')
      this.providers.airnow[
        outcome === 'hit'
          ? 'cacheHits'
          : outcome === 'miss'
            ? 'cacheMisses'
            : 'coalescedRequests'
      ]++;
  }
  stale(mode: DataMode) {
    this.modes[mode].staleResponses++;
  }
  summary() {
    const total = Object.values(this.modes).reduce(
      (sum, m) => ({
        hits: sum.hits + m.hits,
        misses: sum.misses + m.misses,
        coalesced: sum.coalesced + m.coalesced,
        staleResponses: sum.staleResponses + m.staleResponses,
      }),
      { hits: 0, misses: 0, coalesced: 0, staleResponses: 0 },
    );
    return {
      startedAt: this.startedAt,
      scope: 'since-process-start' as const,
      definitions: {
        requests:
          'Completed outbound HTTP attempts, including retries. Successful attempts require 2xx, a bounded readable body and successful decoder validation. Empty validated payloads count as success.',
        latency:
          'Total attempt latency, including body read and validation, excluding retry backoff. Average = totalLatencyMs / completed requests; null with no attempts.',
        cache:
          'Hits are fresh memory-cache returns; misses start one load/revalidation; coalesced requests join an existing load and are counted separately.',
        hitRate:
          'hits / (hits + misses), excluding coalesced requests; null when denominator is zero.',
        exclusions:
          'PostgreSQL reads, synthetic fixtures, documentation reads and client-side ArcGIS requests are not outbound provider attempts. Sample/historical cache decisions are never attributed to AirNow/AQS.',
      },
      providers: Object.entries(this.providers).map(([provider, m]) => ({
        provider,
        ...m,
        averageLatencyMs: m.requests ? m.totalLatencyMs / m.requests : null,
      })),
      cache: {
        ...total,
        hitRate:
          total.hits + total.misses
            ? total.hits / (total.hits + total.misses)
            : null,
        byMode: structuredClone(this.modes),
      },
      clientServices: [
        { provider: 'arcgis', status: 'not tracked locally' as const },
      ],
    };
  }
}
