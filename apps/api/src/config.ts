import { z } from 'zod';
import { dataModeSchema } from '@aq/contracts';

const optionalText = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional(),
);
export const configSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.enum(['127.0.0.1', 'localhost', '::1']).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATA_MODE: dataModeSchema.default('sample'),
    DATABASE_URL: optionalText,
    DB_TARGET_CONFIRMED: optionalText,
    ALLOW_LIVE_API_TESTS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    AIRNOW_API_KEY: optionalText,
    BFF_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3600)
      .default(300),
    BFF_CACHE_STALE_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(3600)
      .default(900),
    UPSTREAM_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(10000)
      .default(3000),
    UPSTREAM_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
    AQS_EMAIL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.email().optional(),
    ),
    AQS_API_KEY: optionalText,
    OPENAI_API_KEY: optionalText,
  })
  .superRefine((config, ctx) => {
    if (!config.DATABASE_URL) return;
    try {
      const url = new URL(config.DATABASE_URL);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        ![
          '/air_quality_geo_research',
          '/air_quality_geo_research_test',
        ].includes(url.pathname) ||
        url.search !== '' ||
        url.hash !== ''
      ) {
        throw new Error('Invalid target');
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'Requires an isolated local PostgreSQL target; see database setup.',
      });
    }
    if (config.DB_TARGET_CONFIRMED !== 'air-quality-geo-research-platform') {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_TARGET_CONFIRMED'],
        message: 'Explicit database ownership confirmation required.',
      });
    }
  });
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  // Zod errors can contain input values. Only expose field paths.
  if (!result.success)
    throw new Error(
      `Invalid configuration fields: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  return result.data;
}
