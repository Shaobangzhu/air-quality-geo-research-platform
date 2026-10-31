import { useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalysisSeriesResponse } from '@aq/contracts';
import { formatLocalTime } from '../map/station-presentation.js';
import { chartRows, SERIES_STYLES } from './presentation.js';

function PointDetails({
  result,
  at,
}: {
  result: AnalysisSeriesResponse;
  at: number;
}) {
  return (
    <div className="point-details">
      <strong>{formatLocalTime(new Date(at).toISOString())}</strong>
      <small>{new Date(at).toISOString()}</small>
      {result.series
        .filter((item) => !item.reason)
        .map((item, index) => {
          const slot = item.slots.find((point) => Date.parse(point.at) === at);
          const records = item.records.filter((row) =>
            slot?.observationIds.includes(row.id),
          );
          return (
            <div
              key={item.station.id}
              className="inspected-series"
              style={{ borderLeftColor: SERIES_STYLES[index]!.color }}
            >
              <strong>
                {item.station.name} ·{' '}
                {item.station.identity.monitorId ?? 'unspecified'}
              </strong>
              {records.length ? (
                records.map((row) => (
                  <p key={row.id}>
                    {row.measurement.value === null
                      ? 'Missing value'
                      : `${row.measurement.value} ${row.measurement.unit}`}{' '}
                    · {row.dataStatus}
                    <small>
                      {row.period.meaning} · {row.period.averagingDescription}
                    </small>
                    <small>
                      Observed {row.observedAt} · Fetched {row.fetchedAt}
                    </small>
                    <small>
                      {row.provenance.sourceAgency} ·{' '}
                      {row.provenance.transportProvider}
                    </small>
                  </p>
                ))
              ) : (
                <p>
                  {slot?.state === 'outside-coverage'
                    ? 'Outside supplied source coverage'
                    : 'No observation supplied'}
                </p>
              )}
              {slot?.state === 'conflict' && (
                <p>Multiple revisions: not plotted or summarized.</p>
              )}
            </div>
          );
        })}
    </div>
  );
}
export default function SeriesChart({
  result,
}: {
  result: AnalysisSeriesResponse;
}) {
  const visible = result.series.filter((item) => !item.reason);
  const rows = chartRows(result.series);
  const [selected, setSelected] = useState(rows.length - 1);
  const inspector = useRef<HTMLDivElement>(null);
  const row = rows[selected];
  const unit = visible[0]?.interpretation?.unit;
  const axis = `${result.meta.measurementType === 'aqi' ? 'AQI' : 'Concentration'} (${unit ?? 'unit unavailable'})`;
  const selectTime = (label: unknown) => {
    if (typeof label !== 'number' && typeof label !== 'string') return;
    const index = rows.findIndex((point) => point.time === Number(label));
    if (index >= 0) setSelected(index);
  };
  if (!rows.length)
    return (
      <p role="status">
        No compatible hourly series to plot. Source records with unverified
        averaging cannot form an hourly line.
      </p>
    );
  return (
    <>
      <p className="chart-axis-label">{axis}</p>
      <div
        className="series-chart"
        role="region"
        aria-label="Observation time-series chart"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 800, height: 370 }}
        >
          <LineChart
            data={rows}
            accessibilityLayer
            margin={{ top: 12, right: 18, left: 4, bottom: 24 }}
            onMouseMove={(state) => {
              // A queued chart hover must not overwrite explicit keyboard/select
              // inspection while focus remains in the inspector controls.
              if (!inspector.current?.contains(document.activeElement))
                selectTime(state.activeLabel);
            }}
            onClick={(state) => selectTime(state.activeLabel)}
          >
            <CartesianGrid stroke="#dce5f1" strokeDasharray="3 3" />
            {Date.parse(result.meta.availableCoverage.window.from) >
              Date.parse(result.meta.window.from) && (
              <ReferenceArea
                x1={Date.parse(result.meta.window.from)}
                x2={Math.min(
                  Date.parse(result.meta.availableCoverage.window.from),
                  Date.parse(result.meta.window.to),
                )}
                fill="#dce4ef"
                fillOpacity={0.45}
              />
            )}
            {Date.parse(result.meta.availableCoverage.window.to) <
              Date.parse(result.meta.window.to) && (
              <ReferenceArea
                x1={Math.max(
                  Date.parse(result.meta.availableCoverage.window.to),
                  Date.parse(result.meta.window.from),
                )}
                x2={Date.parse(result.meta.window.to)}
                fill="#dce4ef"
                fillOpacity={0.45}
              />
            )}
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={[
                Date.parse(result.meta.window.from),
                Date.parse(result.meta.window.to),
              ]}
              tickCount={5}
              tickFormatter={(time: number) =>
                new Intl.DateTimeFormat('en-US', {
                  timeZone: 'America/Los_Angeles',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  timeZoneName: 'short',
                }).format(time)
              }
              tick={{ fontSize: 11 }}
            />
            <YAxis
              width={48}
              domain={['auto', 'auto']}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              filterNull={false}
              content={({ active, label }) =>
                active &&
                (typeof label === 'string' || typeof label === 'number') ? (
                  <div role="tooltip" className="series-tooltip">
                    <PointDetails result={result} at={Number(label)} />
                  </div>
                ) : null
              }
            />
            {visible.map((item, index) => (
              <Line
                key={item.station.id}
                dataKey={item.station.id}
                name={item.station.name}
                type="linear"
                connectNulls={false}
                stroke={SERIES_STYLES[index]!.color}
                strokeDasharray={SERIES_STYLES[index]!.dash}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="series-legend" aria-label="Series legend">
        {visible.map((item, index) => (
          <li key={item.station.id}>
            <svg width="34" height="16" aria-hidden="true">
              <line
                x1="0"
                y1="8"
                x2="34"
                y2="8"
                stroke={SERIES_STYLES[index]!.color}
                strokeWidth="3"
                strokeDasharray={SERIES_STYLES[index]!.dash}
              />
            </svg>
            <span>
              {item.station.name} · Monitor{' '}
              {item.station.identity.monitorId ?? 'unspecified'}
              <small>{SERIES_STYLES[index]!.label}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="catalog-caption">
        America/Los_Angeles (PST/PDT). UTC timestamp positions; shading marks
        time outside supplied source coverage. Missing, null and conflicting
        slots break lines. Straight segments connect adjacent supplied hours
        only; no values are interpolated.
      </p>
      <div className="observation-inspector" ref={inspector}>
        <label>
          Inspect observation time
          <select
            aria-label="Inspect observation time"
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
          >
            {rows.map((point, index) => (
              <option value={index} key={point.time}>
                {formatLocalTime(new Date(point.time).toISOString())} ·{' '}
                {new Date(point.time).toISOString()}
              </option>
            ))}
          </select>
        </label>
        <div className="inspection-buttons">
          <button
            disabled={selected <= 0}
            onClick={() => setSelected((value) => value - 1)}
          >
            Previous hour
          </button>
          <button
            disabled={selected >= rows.length - 1}
            onClick={() => setSelected((value) => value + 1)}
          >
            Next hour
          </button>
        </div>
        {row && (
          <section aria-label="Observation inspection" aria-live="polite">
            <PointDetails result={result} at={row.time} />
          </section>
        )}
      </div>
    </>
  );
}
