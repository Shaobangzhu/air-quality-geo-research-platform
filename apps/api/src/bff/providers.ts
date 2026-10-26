import { readFileSync } from 'node:fs';
import { batchSchema } from '@aq/contracts';
import type { Batch } from '@aq/contracts';
import { BffError } from './errors.js';
import type { ProviderQuery } from './query.js';
import { normalizeImport } from './normalize.js';
import { ProviderHttp } from './http.js';

export interface StationProvider {
  load(query: ProviderQuery): Promise<Batch>;
}
export const SAMPLE_END = '2026-01-15T21:00:00Z';
export class SampleProvider implements StationProvider {
  private readonly batch: Batch;
  constructor(
    input: unknown = JSON.parse(
      readFileSync(
        new URL(
          '../../../../fixtures/synthetic/bff-hourly.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  ) {
    this.batch = normalizeImport(input);
  }
  async load(): Promise<Batch> {
    return structuredClone(this.batch);
  }
}

// Extension seam for an officially reviewed wire specification. No query/field guesses
// are shipped. A test-only synthetic contract exercises the HTTP/validation boundary.
export interface AirNowHourlyContract {
  evidence: string;
  buildRequest(query: ProviderQuery, key: string): URL;
  decode(input: unknown, query: ProviderQuery): unknown;
}
export class AirNowHourlyAdapter implements StationProvider {
  constructor(
    private readonly http: ProviderHttp,
    private readonly key?: string,
    private readonly contract?: AirNowHourlyContract,
  ) {}
  async load(query: ProviderQuery): Promise<Batch> {
    if (!this.key) throw new BffError('PROVIDER_NOT_CONFIGURED');
    if (!this.contract) throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
    const url = this.contract.buildRequest(query, this.key);
    if (
      url.origin !== 'https://www.airnowapi.org' ||
      url.pathname !== '/aq/data/' ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
    return this.http.request('airnow', url, (input) => {
      const batch = batchSchema.parse(this.contract!.decode(input, query));
      if (
        batch.dataMode !== 'live' ||
        batch.sourceId !== 'airnow-hourly' ||
        batch.origin !== 'provider-live'
      )
        throw new BffError('UPSTREAM_MALFORMED', 502);
      return batch;
    });
  }
}
