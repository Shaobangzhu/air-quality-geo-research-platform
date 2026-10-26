import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { STUDY_REGIONS, selectStudyRegion } from '@aq/contracts';
import type { StationReadingsResponse } from '@aq/contracts';
import type { RouteState, RoutePatch } from '../route-state.js';
import { modeNames, modeDescriptions } from '../route-state.js';
import type { DataState } from '../use-stations.js';
import { Icon } from '../components/Icon.js';
import { StationDrawer } from '../components/StationDrawer.js';
import { MapCanvas } from './MapCanvas.js';
import { StationLegend } from './StationLegend.js';
import {
  formatLocalTime,
  markersFor,
  readingStyle,
} from './station-presentation.js';
export function MapExplorer({
  route,
  data,
  change,
  analyze,
}: {
  route: RouteState;
  data: DataState;
  change: (patch: RoutePatch, replace?: boolean) => void;
  analyze: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const region = selectStudyRegion(route.region);
  const [selectionNotice, setSelectionNotice] =
    useState<StationReadingsResponse | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  const [stationsVisible, setStationsVisible] = useState(true);
  const [mapAvailable, setMapAvailable] = useState(false);
  const [candidates, setCandidates] = useState<{
    result: StationReadingsResponse;
    ids: string[];
  } | null>(null);
  const stationButtons = useRef(new Map<string, HTMLButtonElement>());
  const result = data.status === 'ready' ? data.result : undefined;
  const readings = result?.data ?? [];
  const selected = readings.find(
    (reading) => reading.station.id === route.station,
  );
  useEffect(() => {
    if (
      result &&
      route.station &&
      !result.data.some((item) => item.station.id === route.station)
    ) {
      setSelectionNotice(result);
      change({ station: undefined }, true);
    }
  }, [result, route.station, change]);
  const markers = useMemo(
    () =>
      result ? markersFor(result.data, result.meta, route.measurementType) : [],
    [result, route.measurementType],
  );
  const choose = (id: string) => {
    setCandidates(null);
    setSelectionNotice(null);
    change({ station: id });
  };
  const onMapSelect = (ids: string[]) => {
    if (!result) return;
    if (ids.length === 1) choose(ids[0]!);
    else setCandidates({ result, ids });
  };
  const closeDrawer = () => {
    change({ station: undefined });
    if (selected) stationButtons.current.get(selected.station.id)?.focus();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GEOGRAPHIC RESEARCH WORKSPACE</p>
          <h1>Map Explorer</h1>
        </div>
        <div className="page-data-controls">
          <label className="mode-select">
            Map metric
            <select
              aria-label="Map metric"
              value={route.measurementType}
              onChange={(event) =>
                change({
                  measurementType: event.target
                    .value as RouteState['measurementType'],
                })
              }
            >
              <option value="concentration">Concentration</option>
              <option value="aqi">AQI</option>
            </select>
          </label>
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
              onChange={(event) =>
                change({ region: event.target.value as RouteState['region'] })
              }
            >
              {STUDY_REGIONS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.id === 'greater-la' ? 'Greater LA' : preset.name}
                </option>
              ))}
            </select>
            <small id="region-help">
              Engineering preset · not an official basin
            </small>
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
                })
              }
            >
              <option value="PM2.5">PM2.5</option>
              <option value="O3">Ozone (O₃)</option>
              <option value="PM10">PM10</option>
            </select>
            <small>
              {route.measurementType === 'aqi'
                ? 'Supplied AQI categories'
                : 'Source concentration and unit'}
            </small>
          </span>
        </label>
        <label className="filter">
          <Icon name="layers" />
          <span>
            Data Product
            <select
              aria-label="Data Product"
              defaultValue={route.product}
              aria-describedby="product-help"
            >
              <option value="monitoring-stations">Monitoring Stations</option>
              <option value="reporting-areas" disabled>
                Reporting Areas · unavailable
              </option>
              <option value="forecasts" disabled>
                Forecasts · unavailable
              </option>
            </select>
            <small id="product-help">
              {route.mode === 'sample'
                ? 'Synthetic observations'
                : route.mode === 'historical'
                  ? 'Official snapshot required'
                  : 'Live contract unverified'}{' '}
              · other contracts unverified
            </small>
          </span>
        </label>
        <div className="disclaimer">
          <Icon name="info" />
          <p>
            {route.mode === 'sample'
              ? 'Synthetic sample sites and readings. These are fictional development fixtures.'
              : 'Preliminary observations may be revised. Monitoring sites do not represent complete regional coverage.'}
          </p>
        </div>
      </section>
      <section className="map-workspace" aria-label="Map Explorer workspace">
        <div className="map-column">
          <div className="map-panel">
            <MapCanvas
              bounds={region.bbox}
              boundaryVisible={boundaryVisible}
              onAvailability={setMapAvailable}
              markers={markers}
              stationsVisible={stationsVisible}
              selectedId={selected?.station.id}
              onSelect={onMapSelect}
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
                    {!mapAvailable &&
                      ' Map controls available when tiles load.'}
                  </p>
                  <label className="layer-option">
                    <input
                      type="checkbox"
                      checked={stationsVisible}
                      disabled={!mapAvailable || !result}
                      onChange={(event) =>
                        setStationsVisible(event.target.checked)
                      }
                    />
                    <span>Monitoring station readings</span>
                  </label>
                  <StationLegend
                    metric={route.measurementType}
                    readings={readings}
                    meta={result?.meta}
                    pollutant={route.pollutant}
                  />
                </div>
              )}
            </section>
            <span className="map-shell-label">
              {result
                ? modeDescriptions[result.meta.dataMode]
                : `${modeNames[route.mode]} · ${data.status === 'loading' ? 'Loading' : 'Unavailable'}`}
              {result && ` · ${readings.length} monitor identities`}
            </span>
          </div>
          <section className="station-catalog" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <h2 id="catalog-title">
                <Icon name="pin" />
                {route.mode === 'sample'
                  ? 'Synthetic monitor readings'
                  : 'Available monitor readings'}
              </h2>
              <span className="small-tag">
                {result ? `${readings.length} returned` : modeNames[route.mode]}
              </span>
            </div>
            {data.status === 'loading' ? (
              <p role="status">Loading station readings…</p>
            ) : data.status === 'error' ? (
              <p role="alert" className="inline-error">
                {data.message}
              </p>
            ) : (
              <>
                {candidates && candidates.result === result && (
                  <div
                    className="co-located-choice"
                    role="group"
                    aria-label="Choose a monitor at this location"
                  >
                    <strong>Multiple monitors at this location</strong>
                    <p>
                      Source coordinates are retained. Choose a distinct
                      monitor:
                    </p>
                    {readings
                      .filter((reading) =>
                        candidates.ids.includes(reading.station.id),
                      )
                      .map((reading) => (
                        <button
                          key={reading.station.id}
                          onClick={() => choose(reading.station.id)}
                        >
                          {reading.station.name} · Monitor{' '}
                          {reading.station.identity.monitorId ?? 'unspecified'}
                        </button>
                      ))}
                  </div>
                )}
                {readings.length === 0 ? (
                  <p role="status">
                    No {route.pollutant} stations reported in this region and
                    time window.
                  </p>
                ) : (
                  <div className="station-list">
                    {readings.map((reading) => {
                      const station = reading.station;
                      const style = readingStyle(
                        reading,
                        data.result.meta,
                        route.measurementType,
                      );
                      return (
                        <button
                          key={station.id}
                          ref={(element) => {
                            if (element)
                              stationButtons.current.set(station.id, element);
                            else stationButtons.current.delete(station.id);
                          }}
                          className={`station-option ${station.id === selected?.station.id ? 'selected' : ''}`}
                          aria-pressed={station.id === selected?.station.id}
                          aria-label={`Inspect ${station.name}, monitor ${station.identity.monitorId ?? 'unspecified'}`}
                          onClick={() => choose(station.id)}
                        >
                          <span
                            className={`symbol-swatch ${style.style === 'diamond' ? 'neutral' : style.style}`}
                            style={{ background: style.color }}
                            aria-hidden="true"
                          />
                          <span>
                            <strong>{station.name}</strong>
                            <small>
                              {station.identity.nativeSiteId} · Monitor{' '}
                              {station.identity.monitorId ?? 'unspecified'}
                            </small>
                            <small className="reading-summary">
                              {style.label}
                            </small>
                          </span>
                          <Icon name="arrow" />
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="catalog-caption">
                  {modeDescriptions[data.result.meta.dataMode]}. Latest supplied
                  records per metric within the requested window. Select a map
                  symbol or a monitor below; co-located monitors retain distinct
                  identities.
                </p>
                {data.result.meta.latestObservedAt && (
                  <p className="catalog-caption">
                    Latest supplied observation:{' '}
                    {formatLocalTime(data.result.meta.latestObservedAt)} ·
                    America/Los_Angeles
                  </p>
                )}
                {data.result.meta.diagnostics.rejectedRows > 0 && (
                  <p className="inline-error" role="status">
                    {data.result.meta.diagnostics.rejectedRows} invalid or
                    out-of-coverage source rows excluded. Counts describe
                    available source data, not complete regional coverage.
                  </p>
                )}
                {data.result.meta.cache.status === 'stale' && (
                  <p className="inline-error" role="status">
                    Stale cached observations. The source could not be
                    refreshed.
                  </p>
                )}
                {data.result.meta.pagination.nextOffset !== null && (
                  <p className="muted">
                    Showing the first {readings.length} identities; additional
                    results are not displayed.
                  </p>
                )}
                {selectionNotice === result && (
                  <p role="status">
                    The selected station is not available in this filter result.
                    Selection cleared.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
        {selected && result && (
          <StationDrawer
            reading={selected}
            meta={result.meta}
            route={route}
            close={closeDrawer}
            analyze={analyze}
          />
        )}
      </section>
      <footer className="workspace-footer">
        <span>
          <Icon name="map" />
          {region.name} · WGS84
        </span>
        <span>
          Research workbench · Not for regulatory or emergency decisions
        </span>
      </footer>
    </>
  );
}
