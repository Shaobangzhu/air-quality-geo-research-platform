import { useRef, useState } from 'react';
import { GREATER_LA } from '@aq/contracts';
import type { RouteState, RoutePatch } from '../route-state.js';
import { modeNames } from '../route-state.js';
import type { DataState } from '../use-stations.js';
import { Icon } from '../components/Icon.js';
import { StationDrawer } from '../components/StationDrawer.js';
import { MapCanvas } from './MapCanvas.js';
export function MapExplorer({
  route,
  data,
  change,
}: {
  route: RouteState;
  data: DataState;
  change: (patch: RoutePatch) => void;
}) {
  const [legendOpen, setLegendOpen] = useState(true);
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  const [mapAvailable, setMapAvailable] = useState(false);
  const stationButtons = useRef(new Map<string, HTMLButtonElement>());
  const stations = data.status === 'ready' ? data.result.data : [];
  const selected = stations.find((station) => station.id === route.station);
  const closeDrawer = () => {
    change({ station: undefined });
    if (selected) stationButtons.current.get(selected.id)?.focus();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GEOGRAPHIC RESEARCH WORKSPACE</p>
          <h1>Map Explorer</h1>
        </div>
        <label className="mode-select">
          Data mode
          <select
            aria-label="Data mode"
            value={route.mode}
            onChange={(event) =>
              change({
                mode: event.target.value as RouteState['mode'],
                station: undefined,
                snapshotId: undefined,
              })
            }
          >
            <option value="sample">Sample · synthetic</option>
            <option value="historical">Historical · snapshot required</option>
            <option value="live">Live · unavailable</option>
          </select>
        </label>
      </div>
      <section className="map-toolbar" aria-label="Map filters">
        <label className="filter">
          <Icon name="pin" />
          <span>
            Region
            <select
              aria-label="Region"
              value={route.region}
              aria-describedby="region-help"
              disabled
            >
              <option value="greater-la">Greater LA</option>
            </select>
            <small id="region-help">Only supported study extent</small>
          </span>
        </label>
        <label className="filter">
          <Icon name="chart" />
          <span>
            Pollutant
            <select
              aria-label="Pollutant"
              value={route.pollutant}
              onChange={(event) =>
                change({
                  pollutant: event.target.value as RouteState['pollutant'],
                  station: undefined,
                })
              }
            >
              <option value="PM2.5">PM2.5</option>
              <option value="O3">Ozone (O₃)</option>
              <option value="PM10">PM10</option>
            </select>
            <small>Concentration context</small>
          </span>
        </label>
        <label className="filter">
          <Icon name="layers" />
          <span>
            Data Product
            <select
              aria-label="Data Product"
              value={route.product}
              aria-describedby="product-help"
              disabled
            >
              <option value="monitoring-stations">Monitoring Stations</option>
            </select>
            <small id="product-help">Other products are not implemented</small>
          </span>
        </label>
        <div className="disclaimer">
          <Icon name="info" />
          <p>
            {route.mode === 'sample'
              ? 'Synthetic station metadata for development. No real observations are displayed.'
              : 'Preliminary observations are not regulatory data. Availability depends on the selected source.'}
          </p>
        </div>
      </section>
      <section className="map-workspace" aria-label="Map Explorer workspace">
        <div className="map-column">
          <div className="map-panel">
            <MapCanvas
              boundaryVisible={boundaryVisible}
              onAvailability={setMapAvailable}
            />
            <section className="legend-panel" aria-label="Layers and legend">
              <button
                className="legend-heading"
                aria-expanded={legendOpen}
                aria-controls="legend-content"
                onClick={() => setLegendOpen((value) => !value)}
              >
                <Icon name="layers" />
                Layers &amp; Legend
                <span aria-hidden="true">{legendOpen ? '⌃' : '⌄'}</span>
              </button>
              {legendOpen && (
                <div id="legend-content" className="legend-content">
                  <label className="layer-option">
                    <input
                      type="checkbox"
                      checked={boundaryVisible}
                      disabled={!mapAvailable}
                      onChange={(event) =>
                        setBoundaryVisible(event.target.checked)
                      }
                    />
                    <span>
                      Study extent
                      <span className="boundary-swatch" aria-hidden="true" />
                    </span>
                  </label>
                  <p>
                    Engineering extent; not an air-basin boundary.
                    {!mapAvailable && ' Toggle available when the map loads.'}
                  </p>
                  <label className="layer-option">
                    <input type="checkbox" checked={false} disabled />
                    <span>Monitoring station symbols</span>
                  </label>
                  <p>Map layer planned for the next milestone.</p>
                  <div className="legend-note">
                    Concentration context ·{' '}
                    {route.pollutant === 'O3'
                      ? 'unit retained by source (ppm or ppb)'
                      : 'µg/m³'}
                    <br />
                    No measurements or AQI category colors are rendered.
                  </div>
                </div>
              )}
            </section>
            <span className="map-shell-label">
              MAP SHELL · Station layer not implemented
            </span>
          </div>
          <section className="station-catalog" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <h2 id="catalog-title">
                <Icon name="pin" />
                {route.mode === 'sample'
                  ? 'Synthetic monitor identities'
                  : 'Available monitor identities'}
              </h2>
              <span className="small-tag">
                {data.status === 'ready'
                  ? `${stations.length} returned`
                  : modeNames[route.mode]}
              </span>
            </div>
            {data.status === 'loading' ? (
              <p role="status">Loading station metadata…</p>
            ) : data.status === 'error' ? (
              <p role="alert" className="inline-error">
                {data.message}
              </p>
            ) : (
              <>
                {stations.length === 0 ? (
                  <p role="status">
                    No monitor identities match this selection.
                  </p>
                ) : (
                  <div className="station-list">
                    {stations.map((station) => (
                      <button
                        key={station.id}
                        ref={(element) => {
                          if (element)
                            stationButtons.current.set(station.id, element);
                          else stationButtons.current.delete(station.id);
                        }}
                        className={`station-option ${station.id === selected?.id ? 'selected' : ''}`}
                        aria-pressed={station.id === selected?.id}
                        aria-label={`Inspect ${station.name}, monitor ${station.identity.monitorId ?? 'unspecified'}`}
                        onClick={() => change({ station: station.id })}
                      >
                        <Icon name="pin" />
                        <span>
                          <strong>{station.name}</strong>
                          <small>
                            {station.identity.nativeSiteId} · Monitor{' '}
                            {station.identity.monitorId ?? 'unspecified'}
                          </small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="catalog-caption">
                  {route.mode === 'sample'
                    ? 'Explicitly synthetic fixtures. '
                    : ''}
                  Co-located monitors retain distinct identities. Select an
                  identity to inspect its metadata.
                </p>
                {data.result.meta.cache.status === 'stale' && (
                  <p className="inline-error" role="status">
                    Stale cached metadata. The source could not be refreshed.
                  </p>
                )}
                {data.result.meta.pagination.nextOffset !== null && (
                  <p className="muted">
                    Showing the first {stations.length} identities; additional
                    results are not displayed in this milestone.
                  </p>
                )}
                {route.station && !selected && (
                  <p role="status">
                    The linked station is not present in this selection.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
        {selected && (
          <StationDrawer
            station={selected}
            mode={route.mode}
            close={closeDrawer}
          />
        )}
      </section>
      <footer className="workspace-footer">
        <span>
          <Icon name="map" />
          {GREATER_LA.name} · WGS84
        </span>
        <span>
          Research workbench · Not for regulatory or emergency decisions
        </span>
      </footer>
    </>
  );
}
