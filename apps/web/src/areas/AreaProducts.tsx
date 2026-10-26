import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { AreaRecord, AreaProductsResponse } from '@aq/contracts';
import type { RouteState, RoutePatch } from '../route-state.js';
import { routeSearch } from '../route-state.js';
import type { AreaDataState } from '../use-area-products.js';
import { Icon } from '../components/Icon.js';
import {
  formatLocalTime,
  AQI_CATEGORIES,
} from '../map/station-presentation.js';
export const productNames = {
  'reporting-area-aqi': 'Reporting Area AQI',
  forecast: 'Forecast',
} as const;
export function AreaLegend({
  product,
}: {
  product: 'reporting-area-aqi' | 'forecast';
}) {
  return (
    <div
      className="reading-legend"
      aria-label={`${productNames[product]} legend`}
    >
      <strong>
        {product === 'forecast'
          ? 'Forecast categories · predictions'
          : 'Reporting-area AQI · aggregate observations'}
      </strong>
      <p>
        {product === 'forecast'
          ? 'Forecasts predict a valid date/window; they are not observed station measurements.'
          : 'An area aggregate is not the AQI of a specific monitoring station.'}
      </p>
      <ul>
        {AQI_CATEGORIES.map((category) => (
          <li key={category.label}>
            <span
              className="symbol-swatch"
              style={{ background: category.color }}
              aria-hidden="true"
            />
            {category.label}
          </li>
        ))}
      </ul>
      <p>
        Gray swatches mean missing or unavailable categories. No verified area
        centroid or geometry is available. No area symbols or boundaries are
        plotted.
      </p>
    </div>
  );
}
function Value({ row }: { row: AreaRecord }) {
  const color =
    AQI_CATEGORIES.find((category) => category.label === row.category)?.color ??
    '#c6cdd8';
  return (
    <>
      <span
        className="symbol-swatch"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span>
        {row.aqi === null
          ? row.category
            ? 'AQI number not supplied · category only'
            : 'AQI missing'
          : `${row.aqi} AQI`}
        {row.category && ` · ${row.category}`}
      </span>
    </>
  );
}
export function AreaCatalog({
  route,
  data,
  change,
}: {
  route: RouteState;
  data: AreaDataState;
  change: (patch: RoutePatch) => void;
}) {
  const result = data.status === 'ready' ? data.result : undefined;
  const identities = [
    ...new Map(
      result?.data.map((row) => [row.area.id, row.area]) ?? [],
    ).values(),
  ];
  return (
    <section
      className="station-catalog"
      aria-label="Reporting-area product results"
    >
      <div className="catalog-heading">
        <h2>
          <Icon name="layers" />
          {route.product === 'forecast'
            ? 'Forecast · predictions'
            : 'Reporting Area Current AQI'}
        </h2>
        <span className="small-tag">
          {route.mode === 'sample' ? 'Synthetic sample' : route.mode}
        </span>
      </div>
      {data.status === 'loading' ? (
        <p role="status">Loading reporting-area product…</p>
      ) : data.status === 'error' ? (
        <p role="alert" className="inline-error">
          {data.message}
        </p>
      ) : (
        <>
          <p className="catalog-caption">
            {data.result.meta.source.label}. No geographic representative points
            are asserted; select an area below for product-specific details.
          </p>
          {!identities.length ? (
            <p role="status">
              No {route.pollutant}{' '}
              {route.product === 'forecast' ? 'forecast' : 'reporting-area AQI'}{' '}
              records are supplied for this preset.{' '}
              {route.mode === 'sample' &&
                'Sample scope is declared for Greater LA only; this does not establish real regional availability.'}
            </p>
          ) : (
            <div className="station-list">
              {identities.map((area) => (
                <button
                  className={`station-option ${route.area === area.id ? 'selected' : ''}`}
                  key={area.id}
                  id={`area-option-${area.id}`}
                  aria-label={`Inspect reporting area ${area.name}`}
                  aria-pressed={route.area === area.id}
                  onClick={() => change({ area: area.id })}
                >
                  <span>
                    <strong>{area.name}</strong>
                    <small>
                      Area code {area.code} · {area.provider}
                    </small>
                    {data.result.data
                      .filter((row) => row.area.id === area.id)
                      .map((row, index) => (
                        <small className="area-value" key={index}>
                          <Value row={row} />
                          {row.product === 'reporting-area-forecast' &&
                            row.validity.precision === 'date' &&
                            ` · Valid ${row.validity.date}`}
                        </small>
                      ))}
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          )}
          {route.area && !identities.some((area) => area.id === route.area) && (
            <p role="status">
              The linked reporting area is not present in this product result.
              Choose an available area.
            </p>
          )}
          {data.result.meta.pagination.nextOffset !== null && (
            <p className="catalog-caption">
              More bounded source records exist than are displayed.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function AreaDrawer({
  route,
  result,
  close,
  methodology,
}: {
  route: RouteState;
  result: AreaProductsResponse;
  close: () => void;
  methodology: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const rows = result.data.filter((row) => row.area.id === route.area);
  const area = rows[0]?.area;
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (area) closeButton.current?.focus();
  }, [area?.id]);
  if (!area) return null;
  return (
    <aside
      className="station-drawer"
      aria-label="Reporting Area Details"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="panel-heading">
        <h2>
          <Icon name="layers" />
          Reporting Area Details
        </h2>
        <button
          className="icon-button"
          ref={closeButton}
          aria-label="Close reporting area details"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">
        <span className="small-tag">
          {route.mode === 'sample' ? 'Synthetic sample' : route.mode} ·{' '}
          {route.product === 'forecast'
            ? 'Prediction'
            : 'Aggregate observation'}
        </span>
        <h3>{area.name}</h3>
        <dl className="detail-list">
          <div>
            <dt>Reporting area code</dt>
            <dd>{area.code}</dd>
          </div>
          <div>
            <dt>Source identity</dt>
            <dd>{area.provider}</dd>
          </div>
          <div>
            <dt>Geography</dt>
            <dd>
              Not verified. No polygon, centroid or station position inferred.
            </dd>
          </div>
        </dl>
        {rows.map((row, index) => (
          <section
            key={index}
            className="observation-detail"
            aria-label={
              row.product === 'reporting-area-forecast'
                ? 'Forecast record'
                : 'Reporting-area AQI record'
            }
          >
            <div className="area-value">
              <Value row={row} />
            </div>
            <dl className="detail-list">
              <div>
                <dt>Pollutant / product</dt>
                <dd>
                  {row.pollutant} · {row.product}
                </dd>
              </div>
              <div>
                <dt>Reporting agency</dt>
                <dd>{row.reportingAgency}</dd>
              </div>
              {row.product === 'reporting-area-current-aqi' ? (
                <>
                  <div>
                    <dt>Observation time</dt>
                    <dd>
                      {row.observedAt ? (
                        <>
                          {formatLocalTime(row.observedAt)}
                          <small>{row.observedAt}</small>
                        </>
                      ) : (
                        'Not established; no precise UTC instant assumed'
                      )}
                      <small>{row.reportedTimeDescription}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Quality status</dt>
                    <dd>{row.dataStatus}</dd>
                  </div>
                  <div>
                    <dt>Aggregation</dt>
                    <dd>Reporting-area aggregate; not a station reading.</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Issued</dt>
                    <dd>
                      {row.issuedAt ? (
                        <>
                          {formatLocalTime(row.issuedAt)}
                          <small>{row.issuedAt}</small>
                        </>
                      ) : (
                        'Not supplied; issuance time unknown'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Valid</dt>
                    <dd>
                      {row.validity.precision === 'date' ? (
                        <>
                          {row.validity.date} · date only
                          <small>
                            {row.validity.sourceTimeZone ??
                              'Source time zone unverified'}{' '}
                            · no hourly UTC interval inferred
                          </small>
                        </>
                      ) : (
                        <>
                          {row.validity.from} → {row.validity.to}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>Prediction · not an observation</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Fetched</dt>
                <dd>
                  {formatLocalTime(row.fetchedAt)}
                  <small>{row.fetchedAt}</small>
                </dd>
              </div>
              <div>
                <dt>Source category</dt>
                <dd>
                  {row.sourceCategory.label ?? 'Not supplied'}
                  {row.sourceCategory.code !== null && (
                    <small>Code {row.sourceCategory.code}</small>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        ))}
        <p className="catalog-caption">
          {result.meta.source.label} · {result.meta.source.reference}
        </p>
        <a
          className="primary-link"
          href={`/data${routeSearch(route)}`}
          onClick={methodology}
        >
          View Data &amp; Methodology <Icon name="arrow" />
        </a>
      </div>
    </aside>
  );
}
