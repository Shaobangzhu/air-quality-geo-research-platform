import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import esriConfig from '@arcgis/core/config.js';
import ArcgisMapModel from '@arcgis/core/Map.js';
import Point from '@arcgis/core/geometry/Point.js';
import type { ClickEvent } from '@arcgis/core/views/input/types.js';
import type { StationMarker } from './station-presentation.js';
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
  updateStations: (
    markers: StationMarker[],
    visible: boolean,
    selectedId: string | undefined,
  ) => void;
  destroy: () => void;
};
export function mountMap(
  host: HTMLElement,
  key: string,
  bounds: Bounds,
  boundaryVisible: boolean,
  status: (value: 'ready' | 'unavailable') => void,
  select: (ids: string[]) => void = () => {},
): MapHandle {
  // This token is deliberately public; never pass a server credential here.
  esriConfig.apiKey = key;
  const map = new ArcgisMapModel({ basemap: 'arcgis/light-gray' });
  const boundary = new GraphicsLayer({
    title: 'Engineering study extent',
    listMode: 'hide',
    visible: boundaryVisible,
  });
  map.add(boundary);
  const stationLayer = new GraphicsLayer({
    title: 'Monitoring-site observations',
    listMode: 'hide',
  });
  map.add(stationLayer);
  const graphics = new Map<string, Graphic>();
  let clickVersion = 0;
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
  zoom.slot = 'bottom-right';
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
  const updateStations: MapHandle['updateStations'] = (
    markers,
    visible,
    selectedId,
  ) => {
    if (disposed) return;
    clickVersion++;
    stationLayer.visible = visible;
    const ids = new Set(markers.map((marker) => marker.id));
    for (const [id, graphic] of graphics)
      if (!ids.has(id)) {
        stationLayer.remove(graphic);
        graphics.delete(id);
      }
    for (const marker of markers) {
      let graphic = graphics.get(marker.id);
      if (!graphic) {
        graphic = new Graphic({ attributes: { stationId: marker.id } });
        graphics.set(marker.id, graphic);
        stationLayer.add(graphic);
      }
      const point = graphic.geometry as Point | null;
      if (
        !point ||
        point.longitude !== marker.longitude ||
        point.latitude !== marker.latitude
      )
        graphic.geometry = new Point({
          longitude: marker.longitude,
          latitude: marker.latitude,
          spatialReference: { wkid: 4326 },
        });
      graphic.symbol = {
        type: 'simple-marker',
        style: marker.symbol.style,
        color: marker.symbol.color,
        size: marker.id === selectedId ? 19 : 13,
        outline: {
          color: '#183153',
          width: marker.id === selectedId ? 3 : 1.3,
        },
      };
    }
  };
  const click = (event: Event) => {
    if (disposed || !element.ready || !stationLayer.visible) return;
    const version = ++clickVersion;
    void element
      .hitTest((event as CustomEvent<ClickEvent>).detail, {
        include: [stationLayer],
      })
      .then((result) => {
        if (disposed || version !== clickVersion || !stationLayer.visible)
          return;
        const ids = [
          ...new Set(
            result.results.flatMap((hit) =>
              hit.type === 'graphic' &&
              hit.graphic.layer === stationLayer &&
              typeof hit.graphic.attributes?.stationId === 'string' &&
              graphics.has(hit.graphic.attributes.stationId)
                ? [hit.graphic.attributes.stationId as string]
                : [],
            ),
          ),
        ].sort();
        if (ids.length) select(ids);
      })
      .catch(() => {});
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
    clickVersion++;
    graphics.clear();
    element.removeEventListener('arcgisViewClick', click);
    element.removeEventListener('arcgisViewReadyChange', ready);
    element.removeEventListener('arcgisViewReadyError', fail);
    element.removeEventListener('arcgisLoadError', fail);
    // Explicitly release the component-owned view and its map/layers once.
    void element.destroy().catch(() => {});
    element.remove();
  }
  element.addEventListener('arcgisViewClick', click);
  element.addEventListener('arcgisViewReadyChange', ready);
  element.addEventListener('arcgisViewReadyError', fail);
  element.addEventListener('arcgisLoadError', fail);
  update(bounds, boundaryVisible);
  host.append(element);
  return { update, updateStations, destroy };
}
