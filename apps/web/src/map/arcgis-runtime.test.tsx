import { beforeEach, expect, it, vi } from 'vitest';
import { GREATER_LA } from '@aq/contracts';
const mocks = vi.hoisted(() => ({
  destroyed: vi.fn(async () => {}),
  watchRemoved: vi.fn(),
  map: vi.fn(),
  removeAll: vi.fn(),
  addGraphic: vi.fn(),
  layers: [] as {
    title: string;
    visible: boolean;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }[],
  hitTest: vi.fn(),
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
vi.mock('@arcgis/core/geometry/Polygon.js', () => ({
  default: class {
    constructor(properties: unknown) {
      Object.assign(this, properties);
    }
  },
}));
vi.mock('@arcgis/core/geometry/Point.js', () => ({
  default: class {
    constructor(properties: unknown) {
      Object.assign(this, properties);
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
    title = '';
    visible = true;
    remove = vi.fn();
    constructor(options: { title: string; visible?: boolean }) {
      this.title = options.title;
      this.visible = options.visible ?? true;
      mocks.layers.push(this);
    }
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
  hitTest = mocks.hitTest;
  destroy = mocks.destroyed;
  view = { whenLayerView: vi.fn(async () => {}) };
}
if (!customElements.get('arcgis-map'))
  customElements.define('arcgis-map', FakeMap);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.layers.length = 0;
});
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

it('updates one station layer in place, retains co-located graphics, and selects all hit identities', async () => {
  const host = document.createElement('div');
  const select = vi.fn();
  const handle = mountMap(
    host,
    'PUBLIC_TEST_TOKEN',
    GREATER_LA.bbox,
    true,
    vi.fn(),
    select,
  );
  const markers = ['s_a', 's_b'].map((id) => ({
    id,
    longitude: -118.25,
    latitude: 34.05,
    symbol: {
      color: '#00e400',
      style: 'circle' as const,
      label: '20 AQI · Good',
    },
  }));
  handle.updateStations(markers, true, undefined);
  const added = mocks.addGraphic.mock.calls.slice(1).map((call) => call[0]);
  expect(added).toHaveLength(2);
  const firstGraphic = added[0];
  handle.updateStations(markers, true, 's_a');
  expect(mocks.addGraphic).toHaveBeenCalledTimes(3);
  expect(mocks.addGraphic.mock.calls[1]![0]).toBe(firstGraphic);
  expect(mocks.layers).toHaveLength(2); // engineering boundary plus one station layer
  mocks.hitTest.mockResolvedValue({
    results: markers.map((marker) => ({
      type: 'graphic',
      graphic: { attributes: { stationId: marker.id }, layer: mocks.layers[1] },
    })),
  });
  host.firstElementChild!.dispatchEvent(
    new CustomEvent('arcgisViewClick', { detail: { x: 20, y: 20 } }),
  );
  await vi.waitFor(() => expect(select).toHaveBeenCalledWith(['s_a', 's_b']));
  handle.updateStations([markers[1]!], false, undefined);
  expect(mocks.layers[1]!.remove).toHaveBeenCalledWith(firstGraphic);
  expect(mocks.layers[1]!.visible).toBe(false);
  expect(mocks.map).toHaveBeenCalledOnce();
  handle.destroy();
});
it('ignores asynchronous hit tests from an old filter generation or after disposal', async () => {
  const host = document.createElement('div');
  const select = vi.fn();
  const handle = mountMap(
    host,
    'PUBLIC_TEST_TOKEN',
    GREATER_LA.bbox,
    true,
    vi.fn(),
    select,
  );
  const marker = {
    id: 's_a',
    longitude: -118.25,
    latitude: 34.05,
    symbol: { color: '#c6cdd8', style: 'diamond' as const, label: 'Missing' },
  };
  handle.updateStations([marker], true, undefined);
  let resume: (value: unknown) => void = () => {};
  mocks.hitTest.mockImplementation(
    () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  );
  const element = host.firstElementChild!;
  element.dispatchEvent(
    new CustomEvent('arcgisViewClick', { detail: { x: 20, y: 20 } }),
  );
  handle.updateStations([], true, undefined);
  resume({
    results: [
      {
        type: 'graphic',
        graphic: { attributes: { stationId: 's_a' }, layer: mocks.layers[1] },
      },
    ],
  });
  await Promise.resolve();
  expect(select).not.toHaveBeenCalled();
  handle.destroy();
  element.dispatchEvent(
    new CustomEvent('arcgisViewClick', { detail: { x: 20, y: 20 } }),
  );
  expect(mocks.hitTest).toHaveBeenCalledOnce();
});
it('reuses bounded case layers on toggle updates and routes polygon hits independently of hidden stations', async () => {
  const host = document.createElement('div');
  const select = vi.fn();
  const handle = mountMap(
    host,
    'PUBLIC_TEST_TOKEN',
    GREATER_LA.bbox,
    false,
    vi.fn(),
    vi.fn(),
    { select },
  );
  const element = host.firstElementChild!;
  const features = [
    {
      id: 'sra-1',
      layer: 'sra' as const,
      category: 'Very High' as const,
      sourceObjectId: 1,
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [
          [
            [
              [-118, 34],
              [-117.9, 34],
              [-117.9, 34.1],
              [-118, 34],
            ] as [number, number][],
          ],
        ],
      },
    },
  ];
  handle.updateCase!(features, ['sra']);
  const added = mocks.addGraphic.mock.calls.length;
  handle.updateCase!(features, []);
  expect(mocks.addGraphic.mock.calls).toHaveLength(added);
  const layer = mocks.layers.find((l) => l.title === 'Historical case · sra')!;
  expect(layer.visible).toBe(false);
  handle.updateStations([], false, undefined);
  handle.updateCase!(features, ['sra']);
  mocks.hitTest.mockResolvedValue({
    results: [
      {
        type: 'graphic',
        graphic: { layer, attributes: { caseFeatureId: 'sra-1' } },
      },
    ],
  });
  element.dispatchEvent(
    new CustomEvent('arcgisViewClick', { detail: { x: 1, y: 1 } }),
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(select).toHaveBeenCalledWith('sra-1');
  handle.destroy();
  handle.destroy();
  expect(mocks.destroyed).toHaveBeenCalledOnce();
});
