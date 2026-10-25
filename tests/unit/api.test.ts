import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { healthSchema } from '@aq/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { createDatabase } from '../../apps/api/src/database.js';

describe('API health', () => {
  it('creates without making a connection or provider call', () => {
    const probe = vi.fn();
    createApp({ config: readConfig({}), databaseStatus: probe });
    expect(probe).not.toHaveBeenCalled();
  });
  it.each(['connected', 'not-configured', 'unavailable'] as const)(
    'reports %s safely',
    async (database) => {
      const response = await request(
        createApp({
          config: readConfig({ DATA_MODE: 'sample' }),
          databaseStatus: async () => database,
        }),
      ).get('/api/health');
      expect(response.status).toBe(200);
      expect(healthSchema.parse(response.body)).toEqual({
        service: 'aq-research-api',
        status: 'ok',
        database,
        data: {
          state: 'unavailable',
          mode: 'sample',
          reason: 'foundation-only',
        },
      });
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );
  it('redacts errors and keeps the service available on DB failure', async () => {
    const response = await request(
      createApp({
        config: readConfig({ DATA_MODE: 'live' }),
        databaseStatus: async () => {
          throw new Error('postgres://secret-password');
        },
      }),
    ).get('/api/health');
    expect(response.body.database).toBe('unavailable');
    expect(response.body.data.mode).toBe('live');
    expect(response.text).not.toContain('secret-password');
  });
  it('returns JSON 404 without reflecting request input', async () => {
    const response = await request(
      createApp({
        config: readConfig({}),
        databaseStatus: async () => 'not-configured',
      }),
    ).get('/api/not-a-provider');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not-found' });
  });
  it('does not connect when DB is unconfigured', async () => {
    const db = createDatabase(readConfig({}));
    expect(db.pool).toBeUndefined();
    expect(await db.status()).toBe('not-configured');
    await db.close();
  });
  it('handles a driver connection rejection without exposing details', async () => {
    const db = createDatabase(
      readConfig({
        DATABASE_URL: 'postgresql://localhost/air_quality_geo_research',
        DB_TARGET_CONFIRMED: 'air-quality-geo-research-platform',
      }),
    );
    const spy = vi
      .spyOn(db.pool!, 'query')
      .mockRejectedValueOnce(new Error('secret-password'));
    expect(await db.status()).toBe('unavailable');
    spy.mockRestore();
    await db.close();
  });
});
describe('environment validation', () => {
  it('defaults to deterministic sample mode and denies live testing', () => {
    expect(readConfig({})).toMatchObject({
      DATA_MODE: 'sample',
      ALLOW_LIVE_API_TESTS: false,
      HOST: '127.0.0.1',
    });
    expect(() => readConfig({ ALLOW_LIVE_API_TESTS: 'yes' })).toThrow();
  });
  it.each([
    'postgresql://localhost/other_project',
    'postgresql://remote.example/air_quality_geo_research',
    'https://localhost/air_quality_geo_research',
    'postgresql://localhost/air_quality_geo_research?options=unsafe',
  ])('rejects unsafe database target %s', (DATABASE_URL) => {
    expect(() =>
      readConfig({
        DATABASE_URL,
        DB_TARGET_CONFIRMED: 'air-quality-geo-research-platform',
      }),
    ).toThrow();
  });
  it('requires target ownership confirmation and does not leak invalid secrets', () => {
    expect(() =>
      readConfig({
        DATABASE_URL:
          'postgresql://user:TOP_SECRET@localhost/air_quality_geo_research',
      }),
    ).toThrow('DB_TARGET_CONFIRMED');
    try {
      readConfig({ DATABASE_URL: 'TOP_SECRET' });
    } catch (error) {
      expect(String(error)).not.toContain('TOP_SECRET');
    }
    expect(() =>
      readConfig({ PORT: 'NaN', DATA_MODE: 'unavailable' }),
    ).toThrow();
  });
});
