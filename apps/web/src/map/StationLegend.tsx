import type { StationReading, ResponseMeta } from '@aq/contracts';
import { AQI_CATEGORIES, concentrationBins } from './station-presentation.js';
import type { Metric } from './station-presentation.js';
export function StationLegend({
  metric,
  readings,
  meta,
  pollutant,
}: {
  metric: Metric;
  readings: StationReading[];
  meta: ResponseMeta | undefined;
  pollutant: ResponseMeta['pollutant'];
}) {
  const units = [
    ...new Set(
      readings.flatMap((reading) =>
        reading.observations
          .filter((row) => row.measurement.kind === 'concentration')
          .map((row) => row.measurement.unit),
      ),
    ),
  ];
  return (
    <div
      className="reading-legend"
      aria-label={`${metric === 'aqi' ? 'AQI' : 'Concentration'} legend`}
    >
      <strong>
        {metric === 'aqi' ? 'AQI categories' : 'Concentration display bins'}
      </strong>
      {metric === 'aqi' ? (
        <ul>
          {AQI_CATEGORIES.map((category) => (
            <li key={category.label}>
              <span
                className="symbol-swatch"
                style={{ background: category.color }}
                aria-hidden="true"
              />
              <span>
                {category.range} · {category.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {units.length ? (
            units.map((unit) => (
              <ul key={unit}>
                {concentrationBins(pollutant, unit).map((bin) => (
                  <li key={bin.label}>
                    <span
                      className="symbol-swatch"
                      style={{ background: bin.color }}
                      aria-hidden="true"
                    />
                    {bin.label}
                  </li>
                ))}
              </ul>
            ))
          ) : (
            <p>No concentration unit supplied for this selection.</p>
          )}
          <p>
            Display bins only; these are not health thresholds. No AQI
            conversion.
          </p>
          <div className="legend-symbol-line">
            <span className="symbol-swatch triangle" aria-hidden="true" />
            Below zero · source value retained
          </div>
        </>
      )}
      <div className="legend-symbol-line">
        <span className="symbol-swatch neutral" aria-hidden="true" />
        Missing, stale or multiple records
      </div>
      {meta?.dataMode === 'sample' && <p>Synthetic values and locations.</p>}
    </div>
  );
}
