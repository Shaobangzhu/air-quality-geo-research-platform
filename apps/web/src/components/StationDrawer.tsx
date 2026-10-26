import { useEffect, useRef } from 'react';
import type { Observation, ResponseMeta, StationReading } from '@aq/contracts';
import type { RouteState } from '../route-state.js';
import { analysisHref, modeDescriptions } from '../route-state.js';
import {
  aqiCategory,
  formatLocalTime,
  isStale,
  metricRows,
} from '../map/station-presentation.js';
import { Icon } from './Icon.js';
function ObservationDetail({
  row,
  meta,
}: {
  row: Observation;
  meta: ResponseMeta;
}) {
  const measurement = row.measurement;
  const category =
    measurement.kind === 'aqi' ? aqiCategory(measurement.value) : undefined;
  return (
    <section
      className="observation-detail"
      aria-label={`${measurement.kind === 'aqi' ? 'AQI' : 'Concentration'} observation`}
    >
      <div className="observation-value">
        <span>{measurement.kind === 'aqi' ? 'AQI' : 'Concentration'}</span>
        <strong>
          {measurement.value === null
            ? 'Missing'
            : `${measurement.value} ${measurement.unit}`}
        </strong>
      </div>
      {category && (
        <p className="category-label">
          Supplied AQI category: {category.label}
        </p>
      )}
      {isStale(row, meta) && (
        <p className="inline-error">
          Stale observation · original value and timestamps retained
        </p>
      )}
      <dl className="detail-list">
        <div>
          <dt>Data status</dt>
          <dd>
            <span className={`data-status ${row.dataStatus}`}>
              {row.dataStatus}
            </span>
          </dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>
            <time dateTime={row.observedAt}>
              {formatLocalTime(row.observedAt)}
            </time>
            <small>{row.observedAt}</small>
          </dd>
        </div>
        <div>
          <dt>Averaging period</dt>
          <dd>
            {row.period.meaning === 'unknown' ? 'Unknown' : row.period.meaning}
            <small>{row.period.averagingDescription}</small>
            {row.period.startsAt && row.period.endsAt && (
              <small>
                {formatLocalTime(row.period.startsAt)} →{' '}
                {formatLocalTime(row.period.endsAt)}
              </small>
            )}
            <small>Source time zone: {row.period.sourceTimeZone}</small>
          </dd>
        </div>
        <div>
          <dt>Fetched</dt>
          <dd>
            <time dateTime={row.fetchedAt}>
              {formatLocalTime(row.fetchedAt)}
            </time>
            <small>{row.fetchedAt}</small>
          </dd>
        </div>
        <div>
          <dt>Source agency</dt>
          <dd>{row.provenance.sourceAgency}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{row.provenance.transportProvider}</dd>
        </div>
        {row.raw.qualifier && (
          <div>
            <dt>Source qualifier</dt>
            <dd>{row.raw.qualifier}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
export function StationDrawer({
  reading,
  meta,
  route,
  close,
  analyze,
}: {
  reading: StationReading;
  meta: ResponseMeta;
  route: RouteState;
  close: () => void;
  analyze: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const station = reading.station;
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
  }, [station.id]);
  const hasAqi = reading.observations.some(
    (row) => row.measurement.kind === 'aqi',
  );
  const hasConcentration = reading.observations.some(
    (row) => row.measurement.kind === 'concentration',
  );
  const multiple = ['aqi', 'concentration'].some(
    (kind) =>
      reading.observations.filter((row) => row.measurement.kind === kind)
        .length > 1,
  );
  return (
    <aside
      className="station-drawer"
      aria-labelledby="station-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="panel-heading">
        <h2 id="station-title">
          <Icon name="pin" />
          Station Details
        </h2>
        <button
          ref={closeButton}
          className="icon-button"
          onClick={close}
          aria-label="Close station details"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">
        <span className="small-tag">{modeDescriptions[meta.dataMode]}</span>
        <h3>{station.name}</h3>
        <p className="muted">{route.pollutant} · monitoring-site observation</p>
        {meta.dataMode === 'sample' && (
          <div className="info-note">
            <Icon name="info" />
            <p>
              Fictional monitoring sites and values from fixed synthetic
              fixtures.
            </p>
          </div>
        )}
        <div
          className="selected-readings"
          aria-label="Selected monitor latest readings"
        >
          {(['aqi', 'concentration'] as const).map((kind) => {
            const rows = metricRows(reading, kind);
            const row = rows.length === 1 ? rows[0] : undefined;
            return (
              <div key={kind}>
                <span>{kind === 'aqi' ? 'AQI' : 'Concentration'}</span>
                <strong>
                  {row
                    ? row.measurement.value === null
                      ? 'Missing'
                      : `${row.measurement.value} ${row.measurement.unit}`
                    : rows.length
                      ? 'Multiple records'
                      : 'Not supplied'}
                </strong>
                {row && (
                  <small>
                    {formatLocalTime(row.observedAt)} · {row.dataStatus}
                    {isStale(row, meta) ? ' · Stale' : ''}
                  </small>
                )}
              </div>
            );
          })}
        </div>
        <dl className="detail-list">
          <div>
            <dt>Native site ID</dt>
            <dd>{station.identity.nativeSiteId}</dd>
          </div>
          <div>
            <dt>Monitor ID</dt>
            <dd>{station.identity.monitorId ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Parameter ID</dt>
            <dd>{station.identity.parameterId ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {station.coordinate.latitude.toFixed(4)}°,{' '}
              {station.coordinate.longitude.toFixed(4)}°
              <small>WGS84 · source coordinates</small>
            </dd>
          </div>
          <div>
            <dt>Source agency</dt>
            <dd>{station.sourceAgency}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{station.identity.provider}</dd>
          </div>
        </dl>
        <a
          className="primary-link analyze-link"
          href={analysisHref(route, station.id)}
          onClick={analyze}
        >
          <Icon name="chart" />
          Analyze This Station
          <Icon name="arrow" />
        </a>
        {multiple && (
          <p className="inline-error">
            Multiple periods or revisions were supplied at the latest time. All
            records are retained; no single category is assigned to the map
            symbol.
          </p>
        )}
        {!hasAqi && <p className="muted">AQI not supplied.</p>}
        {!hasConcentration && (
          <p className="muted">Concentration not supplied.</p>
        )}
        {reading.observations.map((row) => (
          <ObservationDetail key={row.id} row={row} meta={meta} />
        ))}
        <div className="info-note">
          <Icon name="info" />
          <p>
            Preliminary data may be revised. Times displayed in
            America/Los_Angeles with DST; UTC instants are retained. AQI and
            concentration are supplied independently.
          </p>
        </div>
        {meta.snapshotId && (
          <p className="snapshot-label">Source snapshot: {meta.snapshotId}</p>
        )}
      </div>
    </aside>
  );
}
