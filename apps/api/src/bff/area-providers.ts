import { readFileSync } from 'node:fs';
import { hash } from './normalize.js';
import { z } from 'zod';
import {
  areaBatchSchema,
  areaCurrentAqiSchema,
  areaForecastSchema,
  utcTimestampSchema,
} from '@aq/contracts';
import type { AreaBatch, AreaProductId } from '@aq/contracts';
import { BffError } from './errors.js';
import { ProviderHttp } from './http.js';
export type AreaProviderQuery = {
  product: AreaProductId;
  region: AreaBatch['region'];
  pollutant: AreaBatch['records'][number]['pollutant'];
  areaCode: string | undefined;
};
export function reportingAreaId(
  provider: 'synthetic' | 'airnow',
  code: string,
) {
  return `ra_${hash({ code, provider }).slice(0, 32)}`;
}
export function validateAreaBatch(
  input: unknown,
  secrets: string[] = [],
): AreaBatch {
  const text = JSON.stringify(input);
  const result = areaBatchSchema.safeParse(input);
  if (
    !text ||
    Buffer.byteLength(text) > 125_000 ||
    secrets.some((secret) => secret.length > 0 && text.includes(secret)) ||
    !result.success ||
    result.data.records.some(
      (row) =>
        row.area.id !== reportingAreaId(row.area.provider, row.area.code),
    )
  )
    throw new BffError('UPSTREAM_MALFORMED', 502);
  return result.data;
}
export interface AreaProvider {
  load(query: AreaProviderQuery): Promise<AreaBatch>;
}
const areaFixtureSchema = z.strictObject({
  label: z.string().startsWith('SYNTHETIC SAMPLE').max(160),
  fetchedAt: utcTimestampSchema,
  region: z.literal('greater-la'),
  current: z.array(areaCurrentAqiSchema).max(40),
  forecast: z.array(areaForecastSchema).max(40),
});
export class SampleAreaProvider implements AreaProvider {
  private readonly input: z.infer<typeof areaFixtureSchema>;
  constructor(
    input: unknown = JSON.parse(
      readFileSync(
        new URL(
          '../../../../fixtures/synthetic/area-products.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  ) {
    const parsed = areaFixtureSchema.safeParse(input);
    if (!parsed.success) throw new BffError('UPSTREAM_MALFORMED', 502);
    this.input = parsed.data;
    for (const product of ['reporting-area-aqi', 'forecast'] as const)
      this.batch(product, 'greater-la');
  }
  private batch(product: AreaProductId, region: AreaBatch['region']) {
    return validateAreaBatch({
      product,
      dataMode: 'sample',
      region,
      scope: 'synthetic-fixture-declaration',
      fetchedAt: this.input.fetchedAt,
      archiveId: null,
      source: {
        provider: 'synthetic',
        origin: 'synthetic',
        label: this.input.label,
        reference: 'fixture:area-products-v1',
      },
      records:
        region === this.input.region
          ? product === 'forecast'
            ? this.input.forecast
            : this.input.current
          : [],
    });
  }
  async load(query: AreaProviderQuery) {
    return this.batch(query.product, query.region);
  }
}
export const AREA_ALLOWED_PATHS = {
  'reporting-area-aqi': '/aq/observation/current/racode/',
  forecast: '/aq/forecast/current/',
} as const;
// No official wire codec is registered. Mock-only codecs exercise the boundary;
// these method names and application records are not AirNow payload definitions.
export interface AreaWireContract {
  evidence: string;
  buildRequest(query: AreaProviderQuery, key: string): URL;
  decode(input: unknown, query: AreaProviderQuery): unknown;
}
export class AirNowAreaAdapter implements AreaProvider {
  constructor(
    private readonly http: ProviderHttp,
    private readonly key?: string,
    private readonly contract?: AreaWireContract,
  ) {}
  async load(query: AreaProviderQuery) {
    if (!this.key) throw new BffError('PROVIDER_NOT_CONFIGURED');
    if (!this.contract) throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
    if (!query.areaCode) throw new BffError('INVALID_REQUEST', 400);
    const url = this.contract.buildRequest(query, this.key);
    if (
      url.origin !== 'https://www.airnowapi.org' ||
      url.pathname !== AREA_ALLOWED_PATHS[query.product] ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
    return this.http.request('airnow', url, (input) => {
      const batch = validateAreaBatch(this.contract!.decode(input, query), [
        this.key!,
      ]);
      if (
        batch.dataMode !== 'live' ||
        batch.product !== query.product ||
        batch.region !== query.region ||
        batch.records.some((row) => row.area.code !== query.areaCode)
      )
        throw new BffError('UPSTREAM_MALFORMED', 502);
      return batch;
    });
  }
}
