import { afterEach, expect, it, vi } from 'vitest';
import config from '../../apps/web/vite.config.js';

afterEach(() => vi.unstubAllEnvs());

it('exposes only the exact public ArcGIS token, not other environment prefixes', () => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', 'public-browser-token');
  vi.stubEnv('VITE_ARCGIS_API_KEY_PRIVATE', 'private-sibling-sentinel');
  vi.stubEnv('AIRNOW_API_KEY', 'server-only-sentinel');
  const resolved = config({ mode: 'test', command: 'build' });
  expect(resolved.envPrefix).toEqual([]);
  expect(resolved.define).toEqual({
    'import.meta.env.VITE_ARCGIS_API_KEY': '"public-browser-token"',
  });
});
