import { useEffect, useRef, useState } from 'react';
import { GREATER_LA } from '@aq/contracts';
import { Icon } from '../components/Icon.js';
import type { Bounds, MapHandle, mountMap } from './arcgis-runtime.js';

import type { StationMarker } from './station-presentation.js';
const EMPTY_MARKERS: StationMarker[] = [];
type RuntimeLoader = () => Promise<{ mountMap: typeof mountMap }>;
const loadArcgis: RuntimeLoader = () => import('./arcgis-runtime.js');

export function MapCanvas({
  bounds = GREATER_LA.bbox,
  boundaryVisible,
  onAvailability,
  loadRuntime = loadArcgis,
  markers = EMPTY_MARKERS,
  stationsVisible = true,
  selectedId,
  onSelect,
}: {
  bounds?: Bounds;
  boundaryVisible: boolean;
  onAvailability: (available: boolean) => void;
  loadRuntime?: RuntimeLoader;
  markers?: StationMarker[];
  stationsVisible?: boolean;
  selectedId?: string | undefined;
  onSelect?: ((ids: string[]) => void) | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const latest = useRef({
    bounds,
    boundaryVisible,
    onAvailability,
    markers,
    stationsVisible,
    selectedId,
    onSelect,
  });
  latest.current = {
    bounds,
    boundaryVisible,
    onAvailability,
    markers,
    stationsVisible,
    selectedId,
    onSelect,
  };
  const key = import.meta.env.VITE_ARCGIS_API_KEY?.trim();
  const enabled = Boolean(key);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(
    enabled ? 'loading' : 'unavailable',
  );
  useEffect(() => {
    let active = true;
    let failed = false;
    latest.current.onAvailability(false);
    if (!enabled || !key || !host.current) return;
    const fail = () => {
      if (!active) return;
      failed = true;
      setState('unavailable');
      latest.current.onAvailability(false);
      handle.current?.destroy();
      handle.current = null;
    };
    const deadline = setTimeout(fail, 15000);
    void loadRuntime()
      .then(({ mountMap }) => {
        if (!active || failed || !host.current) return;
        handle.current = mountMap(
          host.current,
          key,
          latest.current.bounds,
          latest.current.boundaryVisible,
          (value) => {
            if (!active || failed) return;
            clearTimeout(deadline);
            if (value === 'unavailable') fail();
            else {
              setState('ready');
              latest.current.onAvailability(true);
            }
          },
          (ids) => latest.current.onSelect?.(ids),
        );
        handle.current.updateStations(
          latest.current.markers,
          latest.current.stationsVisible,
          latest.current.selectedId,
        );
        if (failed) {
          handle.current.destroy();
          handle.current = null;
        }
      })
      .catch(fail);
    return () => {
      active = false;
      clearTimeout(deadline);
      handle.current?.destroy();
      handle.current = null;
    };
  }, [enabled, key, loadRuntime]);
  useEffect(() => {
    handle.current?.update(bounds, boundaryVisible);
  }, [bounds, boundaryVisible]);
  useEffect(() => {
    handle.current?.updateStations(markers, stationsVisible, selectedId);
  }, [markers, stationsVisible, selectedId]);
  return (
    <div className="map-canvas" aria-label="Map canvas">
      <div className="arcgis-host" ref={host} />
      {state !== 'ready' && (
        <div className="map-fallback" role="status">
          <div className="map-fallback-icon">
            <Icon name="map" />
          </div>
          <p className="eyebrow">GREATER LOS ANGELES · 2D GEOGRAPHIC CONTEXT</p>
          <h2>
            {state === 'loading'
              ? 'Loading geographic context…'
              : 'Basemap unavailable'}
          </h2>
          <p>
            {state === 'loading'
              ? 'Connecting to the ArcGIS basemap service.'
              : enabled
                ? 'ArcGIS could not load. Check network access and browser token permissions.'
                : 'A public ArcGIS browser token is required to load tiles.'}
          </p>
          <span className="extent-label">
            WGS84 · {bounds.west}°, {bounds.south}° → {bounds.east}°,{' '}
            {bounds.north}°
          </span>
          <p className="fallback-note">
            Station readings remain available below. This view has no offline
            tile cache.
          </p>
        </div>
      )}
    </div>
  );
}
