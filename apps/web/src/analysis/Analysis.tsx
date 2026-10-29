import { lazy, Suspense } from 'react';
import type { MouseEvent } from 'react';
import { selectStudyRegion } from '@aq/contracts';
import type { RoutePatch, RouteState } from '../route-state.js';
import { modeDescriptions, routeSearch } from '../route-state.js';
import type { AnalysisState } from './use-analysis.js';
import { formatLocalTime } from '../map/station-presentation.js';
import { reasonLabels } from './presentation.js';
import { Icon } from '../components/Icon.js';
import { ResearchAssistant } from './ResearchAssistant.js';
const SeriesChart = lazy(() => import('./SeriesChart.js'));
export function Analysis({
  route,
  data,
  change,
  navigate,
}: {
  route: RouteState;
  data: AnalysisState;
  change: (patch: RoutePatch, replace?: boolean) => void;
  navigate: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
}) {
  const result = data.status === 'ready' ? data.result : undefined;
  const primaryId = route.station ?? result?.primaryId ?? undefined;
  const primary = result?.series.find((item) => item.station.id === primaryId);
  const missingPrimary = primaryId && result && !primary;
  const update = (patch: RoutePatch) =>
    change({ ...patch, compare: [], station: patch.station ?? primaryId });
  const toggle = (id: string) => {
    if (!primaryId) return;
    const current = route.compare;
    change({
      station: primaryId,
      compare: current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 2
          ? [...current, id]
          : current,
    });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ENVIRONMENTAL OBSERVATION WORKSPACE</p>
          <h1>Analysis</h1>
        </div>
        <span className="small-tag">
          {modeDescriptions[route.mode]} ·{' '}
          {selectStudyRegion(route.region).name}
        </span>
      </div>
      <section className="analysis-toolbar" aria-label="Analysis filters">
        <label>
          Primary monitoring station
          <select
            aria-label="Primary monitoring station"
            value={primaryId ?? ''}
            onChange={(event) =>
              change({ station: event.target.value, compare: [] })
            }
          >
            <option value="" disabled>
              {missingPrimary
                ? 'Linked station unavailable in this context'
                : 'Choose an available monitor'}
            </option>
            {primaryId &&
              !result?.candidates.some(
                (item) => item.station.id === primaryId,
              ) && (
                <option value={primaryId}>
                  Linked station · availability unconfirmed
                </option>
              )}
            {result?.candidates.map((item) => (
              <option key={item.station.id} value={item.station.id}>
                {item.station.name} ·{' '}
                {item.station.identity.monitorId ?? 'unspecified'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pollutant
          <select
            aria-label="Pollutant"
            value={route.pollutant}
            onChange={(event) =>
              update({
                pollutant: event.target.value as RouteState['pollutant'],
              })
            }
          >
            <option value="PM2.5">PM2.5</option>
            <option value="O3">Ozone (O₃)</option>
            <option value="PM10">PM10</option>
          </select>
        </label>
        <label>
          Measurement type
          <select
            aria-label="Measurement type"
            value={route.measurementType}
            onChange={(event) =>
              update({
                measurementType: event.target
                  .value as RouteState['measurementType'],
              })
            }
          >
            <option value="concentration">Concentration</option>
            <option value="aqi">AQI</option>
          </select>
        </label>
        <label>
          Observation window
          <select
            aria-label="Observation window"
            value={route.windowHours}
            onChange={(event) =>
              change({
                windowHours: Number(
                  event.target.value,
                ) as RouteState['windowHours'],
              })
            }
          >
            {[24, 48, 72].map((hours) => (
              <option key={hours} value={hours}>
                Last {hours} hours
              </option>
            ))}
          </select>
        </label>
      </section>
      {route.mode === 'sample' && (
        <p className="analysis-mode-note">
          Synthetic sample · fictional monitors and readings. The requested
          recent window is anchored to the fixed fixture end, not current
          wall-clock time.
        </p>
      )}
      {route.mode === 'historical' && result && (
        <p className="analysis-mode-note">
          Historical snapshot · acquired{' '}
          {formatLocalTime(result.meta.fetchedAt)} ({result.meta.fetchedAt}) ·{' '}
          {result.acquisition.label}
        </p>
      )}
      <div className="analysis-workspace">
        <div className="analysis-main">
          <section className="analysis-card" aria-labelledby="trends-title">
            <div className="catalog-heading">
              <h2 id="trends-title">
                <Icon name="chart" />
                Observation Trends
              </h2>
              <span>
                {route.pollutant} · {route.windowHours}h
              </span>
            </div>
            {data.status === 'loading' ? (
              <p role="status">Loading observation series…</p>
            ) : data.status === 'error' ? (
              <p role="alert" className="inline-error">
                {data.message}
              </p>
            ) : (
              <>
                {missingPrimary && (
                  <p role="status">
                    The linked primary station is not available for this
                    pollutant and region. Choose an available monitor; no
                    replacement was selected automatically.
                  </p>
                )}
                {!result?.candidates.length && (
                  <p role="status">
                    No {route.pollutant} observations reported in this region
                    and window.
                  </p>
                )}
                {result && (
                  <>
                    <p className="catalog-caption">
                      Observation timestamps:{' '}
                      {formatLocalTime(result.meta.window.from)} →{' '}
                      {formatLocalTime(result.meta.window.to)} (end exclusive).
                    </p>
                    {result.meta.cache.status === 'stale' && (
                      <p role="status" className="inline-error">
                        Stale cached source data. Original acquisition and
                        observation times are retained.
                      </p>
                    )}
                    {primary?.reason && (
                      <p role="status">{reasonLabels[primary.reason]}</p>
                    )}
                    <Suspense fallback={<p role="status">Loading chart…</p>}>
                      <SeriesChart
                        key={`${result.meta.pollutant}-${result.meta.measurementType}-${result.windowHours}-${result.series.map((item) => item.station.id).join(',')}`}
                        result={result}
                      />
                    </Suspense>
                  </>
                )}
              </>
            )}
          </section>
          <section
            className="analysis-card observation-notes"
            aria-labelledby="notes-title"
          >
            <h2 id="notes-title">
              <Icon name="info" />
              Observation Notes
            </h2>
            <ul>
              <li>
                AQI and concentration are separate measurements. No conversion
                is calculated.
              </li>
              <li>
                Missing timestamps and null values are gaps. Outside source
                coverage is counted separately; no zero fill or interpolation.
              </li>
              <li>
                Preliminary data may be revised. Synthetic samples and unknown
                status do not establish regulatory validity.
              </li>
            </ul>
            <a
              href={`/data${routeSearch(route)}`}
              onClick={(event) => navigate(event, '/data')}
            >
              View Data &amp; Methodology <Icon name="arrow" />
            </a>
          </section>
        </div>
        <aside
          className="analysis-sidebar"
          aria-label="Analysis station and summary"
        >
          <section className="analysis-card">
            <h2>
              <Icon name="pin" />
              Selected Station
            </h2>
            {primary ? (
              <>
                <p className="analysis-selection">
                  Selected monitor: <strong>{primary.station.name}</strong>
                  <br />
                  {route.pollutant} · {route.mode} · {primary.station.id}
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Native site / monitor</dt>
                    <dd>
                      {primary.station.identity.nativeSiteId} /{' '}
                      {primary.station.identity.monitorId ?? 'unspecified'}
                    </dd>
                  </div>
                  <div>
                    <dt>Parameter</dt>
                    <dd>
                      {primary.station.identity.parameterId ?? 'Not supplied'}
                    </dd>
                  </div>
                  <div>
                    <dt>Source agency</dt>
                    <dd>{primary.station.sourceAgency}</dd>
                  </div>
                  <div>
                    <dt>Provider</dt>
                    <dd>{primary.station.identity.provider}</dd>
                  </div>
                  <div>
                    <dt>Quality statuses</dt>
                    <dd>
                      {[
                        ...new Set(
                          primary.records.map((row) => row.dataStatus),
                        ),
                      ].join(', ') || 'Not supplied'}
                    </dd>
                  </div>
                  <div>
                    <dt>Period alignment</dt>
                    <dd>
                      {primary.interpretation?.alignment ?? 'Unverified'}
                      <small>
                        {primary.interpretation?.averagingDescription}
                      </small>
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p>
                {primaryId
                  ? 'Linked station availability is not confirmed for this context.'
                  : 'Select a monitor to inspect its observations.'}
              </p>
            )}
          </section>
          <section
            className="analysis-card"
            role="region"
            aria-label="Analysis summary"
          >
            <h2>
              <Icon name="chart" />
              Window Summary
            </h2>
            {primary?.summary ? (
              <>
                <dl className="detail-list">
                  <div>
                    <dt>Observed range</dt>
                    <dd>
                      {primary.summary.min === null
                        ? 'No comparable values'
                        : `${primary.summary.min} – ${primary.summary.max} ${primary.interpretation!.unit}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Available observations</dt>
                    <dd>{primary.summary.availableCount}</dd>
                  </div>
                  <div>
                    <dt>Missing slots</dt>
                    <dd>{primary.summary.missingCount}</dd>
                  </div>
                  <div>
                    <dt>Unreported / null</dt>
                    <dd>
                      {primary.summary.absentCount} /{' '}
                      {primary.summary.nullCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Outside source coverage</dt>
                    <dd>{primary.summary.outsideCoverageCount}</dd>
                  </div>
                  <div>
                    <dt>Conflicting slots</dt>
                    <dd>{primary.summary.conflictCount}</dd>
                  </div>
                  {primary.summary.peakAt && (
                    <div>
                      <dt>Unique observed peak</dt>
                      <dd>{formatLocalTime(primary.summary.peakAt)}</dd>
                    </div>
                  )}
                </dl>
                <p className="catalog-caption">
                  Calculated from single numeric observations with the same unit
                  and verified hourly interpretation. Zero and negative values
                  are retained; nulls, absent slots and conflicting revisions
                  are excluded from min/max. Counts describe {route.windowHours}{' '}
                  UTC timestamp slots, not provider completeness.
                </p>
              </>
            ) : (
              <p>No comparable primary series to summarize.</p>
            )}
          </section>
          <section className="analysis-card">
            <h2>
              <Icon name="layers" />
              Compare Stations
            </h2>
            <p className="catalog-caption">
              Primary plus up to two monitors. Distinct source identities may
              share coordinates.
            </p>
            <div className="comparison-list">
              {result?.candidates.map((item) => {
                const isPrimary = item.station.id === primaryId;
                const checked =
                  isPrimary || route.compare.includes(item.station.id);
                return (
                  <label key={item.station.id}>
                    <input
                      type="checkbox"
                      aria-label={`Compare ${item.station.name}, monitor ${item.station.identity.monitorId ?? 'unspecified'}`}
                      checked={checked}
                      disabled={
                        isPrimary ||
                        (!checked &&
                          (!!item.reason || route.compare.length >= 2))
                      }
                      onChange={() => toggle(item.station.id)}
                    />
                    <span>
                      {item.station.name} ·{' '}
                      {item.station.identity.monitorId ?? 'unspecified'}
                      {item.reason && (
                        <small>{reasonLabels[item.reason]}</small>
                      )}
                      {isPrimary && <small>Primary station</small>}
                    </span>
                  </label>
                );
              })}
            </div>
            {result?.missingStationIds
              .filter((id) => id !== primaryId)
              .map((id) => (
                <p key={id} className="catalog-caption">
                  A linked comparison station is absent from this filter result.
                </p>
              ))}
            {result?.series
              .filter((item) => item.reason && item.station.id !== primaryId)
              .map((item) => (
                <p key={item.station.id} className="catalog-caption">
                  {item.station.name}: {reasonLabels[item.reason!]}
                </p>
              ))}
          </section>
        </aside>
      </div>
      {result && (
        <ResearchAssistant
          key={JSON.stringify([
            route,
            result.meta.window,
            result.meta.snapshotId,
          ])}
          data={result}
        />
      )}
    </>
  );
}
