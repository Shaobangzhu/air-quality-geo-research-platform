import { beforeEach, expect, it, vi } from 'vitest';
import { GREATER_LA } from '@aq/contracts';
const mocks = vi.hoisted(() => ({
  destroyed: vi.fn(async () => {}),
  watchRemoved: vi.fn(),
  map: vi.fn(),
  removeAll: vi.fn(),
  addGraphic: vi.fn(),
  fatal: undefined as undefined | ((error: unknown) => void),
}));
vi.mock('@arcgis/map-components/components/arcgis-map', () => ({}));
vi.mock('@arcgis/map-components/components/arcgis-zoom', () => ({}));
vi.mock('@arcgis/core/config.js', () => ({ default: {} }));
vi.mock('@arcgis/core/Map.js', () => ({
  default: class {
    basemap = { loadAll: async () => {}, baseLayers: [] };
    add = vi.fn();
    constructor(options: unknown) {
      mocks.map(options);
    }
  },
}));
vi.mock('@arcgis/core/geometry/Extent.js', () => ({
  default: class {
    constructor(properties: unknown) {
      Object.assign(this, properties);
    }
    expand() {
      return this;
    }
  },
}));
vi.mock('@arcgis/core/Graphic.js', () => ({
  default: class {
    constructor(properties: unknown) {
      Object.assign(this, properties);
    }
  },
}));
vi.mock('@arcgis/core/views/2d/MapViewConstraints.js', () => ({
  default: class {},
}));
vi.mock('@arcgis/core/layers/GraphicsLayer.js', () => ({
  default: class {
    visible = true;
    add = mocks.addGraphic;
    removeAll = mocks.removeAll;
  },
}));
vi.mock('@arcgis/core/core/reactiveUtils.js', () => ({
  watch: (_getter: unknown, callback: (error: unknown) => void) => {
    mocks.fatal = callback;
    return { remove: mocks.watchRemoved };
  },
}));
import { mountMap } from './arcgis-runtime.js';
class FakeMap extends HTMLElement {
  ready = true;
  destroy = mocks.destroyed;
  view = { whenLayerView: vi.fn(async () => {}) };
}
if (!customElements.get('arcgis-map'))
  customElements.define('arcgis-map', FakeMap);
beforeEach(() => vi.clearAllMocks());
it('uses one component-owned map, updates the existing boundary and extent and removes listeners on destruction', async () => {
  const host = document.createElement('div');
  const status = vi.fn();
  const handle = mountMap(
    host,
    'PUBLIC_TEST_TOKEN',
    GREATER_LA.bbox,
    true,
    status,
  );
  const element = host.firstElementChild!;
  expect(mocks.map).toHaveBeenCalledWith({ basemap: 'arcgis/light-gray' });
  expect(host.querySelectorAll('arcgis-map')).toHaveLength(1);
  element.dispatchEvent(new Event('arcgisViewReadyChange'));
  await vi.waitFor(() => expect(status).toHaveBeenCalledWith('ready'));
  handle.update(GREATER_LA.bbox, false);
  expect(mocks.addGraphic).toHaveBeenCalledOnce();
  handle.update({ ...GREATER_LA.bbox, west: -118.9 }, true);
  expect(mocks.addGraphic).toHaveBeenCalledTimes(2);
  expect(mocks.map).toHaveBeenCalledOnce();
  handle.destroy();
  handle.destroy();
  expect(mocks.destroyed).toHaveBeenCalledOnce();
  expect(mocks.watchRemoved).toHaveBeenCalledOnce();
  expect(host.childElementCount).toBe(0);
  element.dispatchEvent(new Event('arcgisLoadError'));
  expect(status).toHaveBeenCalledTimes(1);
});
it('stops and disposes on a tile loading error without exposing SDK errors', () => {
  const host = document.createElement('div');
  const status = vi.fn();
  const handle = mountMap(
    host,
    'PUBLIC_TEST_TOKEN',
    GREATER_LA.bbox,
    true,
    status,
  );
  host.firstElementChild!.dispatchEvent(new Event('arcgisLoadError'));
  expect(status).toHaveBeenCalledWith('unavailable');
  handle.destroy();
  expect(mocks.destroyed).toHaveBeenCalledOnce();
});
it('disposes after a fatal view error', () => {
  const host = document.createElement('div');
  const status = vi.fn();
  mountMap(host, 'PUBLIC_TEST_TOKEN', GREATER_LA.bbox, true, status);
  mocks.fatal?.(new Error('PRIVATE_DETAILS'));
  expect(status).toHaveBeenCalledWith('unavailable');
  expect(mocks.destroyed).toHaveBeenCalledOnce();
});
