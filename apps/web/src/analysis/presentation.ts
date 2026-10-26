import type { AnalysisSeries, SeriesReason } from '@aq/contracts';
export const SERIES_STYLES = [
  { color: '#1459ba', dash: 'none', label: 'Solid line' },
  { color: '#a04800', dash: '8 4', label: 'Dashed line' },
  { color: '#627017', dash: '2 4', label: 'Dotted line' },
] as const;
export const reasonLabels: Record<SeriesReason, string> = {
  'measurement-unavailable': 'This measurement was not supplied.',
  'units-inconsistent':
    'Source records use different units. No unit conversion is applied.',
  'averaging-unverified':
    'Hourly boundaries or timestamp alignment are not established. Records cannot form an hourly line.',
  'averaging-inconsistent':
    'Source records have different averaging interpretations.',
  'unit-mismatch':
    'Units differ from the primary station. Select this station as primary to inspect its own unit.',
  'averaging-mismatch':
    'Averaging interpretation differs from the primary station.',
  'primary-unavailable':
    'Choose an available primary station before comparing.',
};
export function chartRows(series: AnalysisSeries[]) {
  const visible = series.filter((item) => !item.reason);
  const timeline = visible[0]?.slots ?? [];
  const records = new Map(
    visible.flatMap((item) =>
      item.records.map((row) => [row.id, row] as const),
    ),
  );
  return timeline.map(
    (slot, index) =>
      Object.fromEntries([
        ['time', Date.parse(slot.at)],
        ...visible.map((item) => {
          const point = item.slots[index];
          const row =
            point?.state === 'observed'
              ? records.get(point.observationIds[0]!)
              : undefined;
          return [item.station.id, row?.measurement.value ?? null];
        }),
      ]) as Record<string, number | null> & { time: number },
  );
}
