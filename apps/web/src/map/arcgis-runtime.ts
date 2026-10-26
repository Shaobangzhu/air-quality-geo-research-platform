import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import esriConfig from '@arcgis/core/config.js';
import Map from '@arcgis/core/Map.js';
import MapViewConstraints from '@arcgis/core/views/2d/MapViewConstraints.js';
import Extent from '@arcgis/core/geometry/Extent.js';
import Graphic from '@arcgis/core/Graphic.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import type { GREATER_LA } from '@aq/contracts';

export type Bounds = typeof GREATER_LA.bbox;
export type MapHandle = {
  update: (bounds: Bounds, boundaryVisible: boolean) => void;
  destroy: () => void;
};
export function mountMap(
  host: HTMLElement,
  key: string,
  bounds: Bounds,
  boundaryVisible: boolean,
  status: (value: 'ready' | 'unavailable') => void,
): MapHandle {
  // This token is deliberately public; never pass a server credential here.
  esriConfig.apiKey = key;
  const map = new Map({ basemap: 'arcgis/light-gray' });
  const boundary = new GraphicsLayer({
    title: 'Engineering study extent',
    listMode: 'hide',
    visible: boundaryVisible,
  });
  map.add(boundary);
  const element = document.createElement('arcgis-map') as ArcgisMap;
  element.autoDestroyDisabled = true;
  element.map = map;
  element.popupDisabled = true;
  element.aria = { label: 'Greater LA geographic context map' };
  element.constraints = new MapViewConstraints({
    minZoom: 7,
    maxZoom: 16,
    rotationEnabled: false,
  });
  const zoom = document.createElement('arcgis-zoom');
  zoom.slot = 'bottom-left';
  element.append(zoom);
  let disposed = false;
  let preparing = false;
  let lastBounds = '';
  const update: MapHandle['update'] = (next, visible) => {
    if (disposed) return;
    boundary.visible = visible;
    const signature = JSON.stringify(next);
    if (signature === lastBounds) return;
    lastBounds = signature;
    const extent = new Extent({
      xmin: next.west,
      ymin: next.south,
      xmax: next.east,
      ymax: next.north,
      spatialReference: { wkid: 4326 },
    });
    boundary.removeAll();
    boundary.add(
      new Graphic({
        geometry: extent,
        symbol: {
          type: 'simple-fill',
          color: [0, 0, 0, 0],
          outline: {
            type: 'simple-line',
            color: '#42689b',
            width: 1.5,
            style: 'dash',
          },
        },
      }),
    );
    element.extent = extent.expand(1.08);
  };
  const fail = () => {
    if (!disposed) {
      status('unavailable');
      destroy();
    }
  };
  const ready = () => {
    if (disposed || preparing || !element.ready) return;
    preparing = true;
    // View readiness alone does not establish basemap availability.
    void map.basemap
      ?.loadAll()
      .then(async () => {
        await Promise.all(
          map.basemap!.baseLayers.map((layer) =>
            element.view.whenLayerView(layer),
          ),
        );
        if (!disposed) status('ready');
      })
      .catch(fail);
  };
  const fatal = reactiveUtils.watch(
    () => element.fatalError,
    (error) => {
      if (error) fail();
    },
  );
  function destroy() {
    if (disposed) return;
    disposed = true;
    fatal.remove();
    element.removeEventListener('arcgisViewReadyChange', ready);
    element.removeEventListener('arcgisViewReadyError', fail);
    element.removeEventListener('arcgisLoadError', fail);
    // Explicitly release the component-owned view and its map/layers once.
    void element.destroy().catch(() => {});
    element.remove();
  }
  element.addEventListener('arcgisViewReadyChange', ready);
  element.addEventListener('arcgisViewReadyError', fail);
  element.addEventListener('arcgisLoadError', fail);
  update(bounds, boundaryVisible);
  host.append(element);
  return { update, destroy };
}
