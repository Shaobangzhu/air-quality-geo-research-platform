import type { Observation, ResponseMeta, StationReading } from '@aq/contracts';
export type Metric = 'aqi' | 'concentration';
export const AQI_CATEGORIES = [
  { max: 50, label: 'Good', range: '0–50', color: '#00e400' },
  { max: 100, label: 'Moderate', range: '51–100', color: '#ffff00' },
  {
    max: 150,
    label: 'Unhealthy for Sensitive Groups',
    range: '101–150',
    color: '#ff7e00',
  },
  { max: 200, label: 'Unhealthy', range: '151–200', color: '#ff0000' },
  { max: 300, label: 'Very Unhealthy', range: '201–300', color: '#8f3f97' },
  { max: Infinity, label: 'Hazardous', range: '301+', color: '#7e0023' },
] as const;
export function aqiCategory(value: number | null) {
  return value !== null && Number.isInteger(value) && value >= 0
    ? AQI_CATEGORIES.find((category) => value <= category.max)
    : undefined;
}
export function concentrationBins(
  pollutant: ResponseMeta['pollutant'],
  unit: string,
) {
  const cuts =
    pollutant === 'O3'
      ? unit === 'ppm'
        ? [0.025, 0.05]
        : [25, 50]
      : pollutant === 'PM10'
        ? [30, 60]
        : [10, 25];
  return [
    { max: cuts[0]!, label: `0–${cuts[0]} ${unit}`, color: '#b9d5ff' },
    {
      max: cuts[1]!,
      label: `>${cuts[0]}–${cuts[1]} ${unit}`,
      color: '#527fc6',
    },
    { max: Infinity, label: `>${cuts[1]} ${unit}`, color: '#173f80' },
  ];
}
export function metricRows(
  reading: StationReading,
  metric: Metric,
): Observation[] {
  return reading.observations.filter((row) => row.measurement.kind === metric);
}
export function isStale(row: Observation, meta: ResponseMeta) {
  return (
    meta.cache.status === 'stale' ||
    (meta.dataMode === 'live' &&
      Date.parse(row.observedAt) < Date.parse(meta.window.to) - 2 * 3_600_000)
  );
}
export type MarkerStyle = {
  color: string;
  style: 'circle' | 'diamond' | 'triangle';
  label: string;
};
export function readingStyle(
  reading: StationReading,
  meta: ResponseMeta,
  metric: Metric,
): MarkerStyle {
  const rows = metricRows(reading, metric);
  const row = rows[0];
  const neutral = (label: string): MarkerStyle => ({
    color: '#c6cdd8',
    style: 'diamond',
    label,
  });
  if (rows.length > 1)
    return neutral('Multiple periods or revisions — inspect records');
  if (!row || row.measurement.value === null)
    return neutral('Missing / not supplied');
  if (isStale(row, meta)) return neutral('Stale observation');
  const value = row.measurement.value;
  if (metric === 'aqi') {
    const category = aqiCategory(value);
    return category
      ? {
          color: category.color,
          style: 'circle',
          label: `${value} AQI · ${category.label}`,
        }
      : neutral('Unknown AQI');
  }
  if (value < 0)
    return {
      color: '#e0ebff',
      style: 'triangle',
      label: `${value} ${row.measurement.unit} · below zero, source value retained`,
    };
  const bin = concentrationBins(meta.pollutant, row.measurement.unit).find(
    (item) => value <= item.max,
  )!;
  return {
    color: bin.color,
    style: 'circle',
    label: `${value} ${row.measurement.unit}`,
  };
}
export type StationMarker = {
  id: string;
  longitude: number;
  latitude: number;
  symbol: MarkerStyle;
};
export function markersFor(
  readings: StationReading[],
  meta: ResponseMeta,
  metric: Metric,
): StationMarker[] {
  return readings.map((reading) => ({
    id: reading.station.id,
    ...reading.station.coordinate,
    symbol: readingStyle(reading, meta, metric),
  }));
}
export function formatLocalTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(value));
}
