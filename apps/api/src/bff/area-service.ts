import { z } from 'zod';
import {
  areaCodeSchema,
  areaProductIdSchema,
  areaProductsResponseSchema,
  dataModeSchema,
  pollutantSchema,
  regionIdSchema,
} from '@aq/contracts';
import type { AreaProductId, DataMode } from '@aq/contracts';
import { AreaCache } from './area-cache.js';
import { validateAreaBatch } from './area-providers.js';
import type { AreaProvider } from './area-providers.js';
import { BffError } from './errors.js';
import { canonical } from './normalize.js';
import { validate } from './query.js';
import type { Usage } from './usage.js';
const integer = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
export const areaQuerySchema = z.strictObject({
  region: regionIdSchema.default('greater-la'),
  mode: dataModeSchema.default('sample'),
  pollutant: pollutantSchema.default('PM2.5'),
  areaCode: areaCodeSchema.optional(),
  limit: integer(1, 20).default(10),
  offset: integer(0, 39).default(0),
});
export class AreaProductService {
  private readonly cache: AreaCache;
  constructor(
    private readonly options: {
      sample: AreaProvider;
      live: AreaProvider;
      usage: Usage;
      defaultMode: DataMode;
      now?: () => number;
    },
  ) {
    this.cache = new AreaCache(options.usage, options.now);
  }
  async read(product: AreaProductId, raw: unknown) {
    areaProductIdSchema.parse(product);
    const query = validate(areaQuerySchema, raw);
    const mode =
      raw && typeof raw === 'object' && !Object.hasOwn(raw, 'mode')
        ? this.options.defaultMode
        : query.mode;
    if (mode === 'historical')
      throw new BffError('PRODUCT_HISTORY_UNAVAILABLE', 503);
    // No archive, postcode walk, or unbounded regional provider enumeration.
    const key = canonical({
      product,
      mode,
      region: query.region,
      pollutant: query.pollutant,
      areaCode: mode === 'live' ? (query.areaCode ?? null) : null,
    });
    const result = await this.cache.get(
      key,
      mode,
      product === 'forecast' ? 1_800_000 : 300_000,
      async () => {
        const batch = await (
          mode === 'sample' ? this.options.sample : this.options.live
        ).load({
          product,
          region: query.region,
          pollutant: query.pollutant,
          areaCode: query.areaCode,
        });
        const checked = validateAreaBatch(batch);
        if (
          checked.dataMode !== mode ||
          checked.product !== product ||
          checked.region !== query.region
        )
          throw new BffError('UPSTREAM_MALFORMED', 502);
        return checked;
      },
    );
    const records = result.batch.records.filter(
      (row) =>
        row.pollutant === query.pollutant &&
        (!query.areaCode || row.area.code === query.areaCode),
    );
    const data = records.slice(query.offset, query.offset + query.limit);
    const {
      product: sourceProduct,
      dataMode,
      region,
      scope,
      fetchedAt,
      archiveId,
      source,
    } = result.batch;
    const metadata = {
      product: sourceProduct,
      dataMode,
      region,
      scope,
      fetchedAt,
      archiveId,
      source,
    };
    return areaProductsResponseSchema.parse({
      data,
      meta: {
        ...metadata,
        pollutant: query.pollutant,
        resultState: data.length ? 'complete' : 'empty',
        geometryStatus: 'not-verified-no-symbols',
        cache: result.cache,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: records.length,
          nextOffset:
            query.offset + query.limit < records.length
              ? query.offset + query.limit
              : null,
        },
      },
    });
  }
}
