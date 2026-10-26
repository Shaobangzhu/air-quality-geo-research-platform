import {
  observationInterpretation,
  hourlyTimeline,
  summarizeSeries,
} from '@aq/contracts';
import type {
  AnalysisSeries,
  Batch,
  Interpretation,
  Observation,
  ResponseMeta,
  SeriesReason,
  SeriesSlot,
} from '@aq/contracts';

type Profile = {
  interpretation: Interpretation | null;
  reason: SeriesReason | null;
};
function profile(rows: Observation[]): Profile {
  if (!rows.length)
    return { interpretation: null, reason: 'measurement-unavailable' };
  if (new Set(rows.map((row) => row.measurement.unit)).size !== 1)
    return { interpretation: null, reason: 'units-inconsistent' };
  const meanings = rows.map(observationInterpretation);
  if (meanings.some((value) => value === null))
    return { interpretation: null, reason: 'averaging-unverified' };
  if (new Set(meanings.map((value) => JSON.stringify(value))).size !== 1)
    return { interpretation: null, reason: 'averaging-inconsistent' };
  return { interpretation: meanings[0]!, reason: null };
}
export function buildAnalysis(
  batch: Batch,
  observations: Observation[],
  allObservations: Observation[],
  meta: ResponseMeta,
  requested: string[] | undefined,
  windowHours: 24 | 48 | 72,
) {
  const present = new Set(allObservations.map((row) => row.stationId));
  const stations = batch.stations.filter((station) => present.has(station.id));
  const rows = new Map(
    stations.map((station) => [
      station.id,
      observations.filter((row) => row.stationId === station.id),
    ]),
  );
  const profiles = new Map(
    stations.map((station) => [station.id, profile(rows.get(station.id)!)]),
  );
  const ids = requested ?? (stations[0] ? [stations[0].id] : []);
  const primaryId = ids[0] ?? null;
  const primary = primaryId ? profiles.get(primaryId) : undefined;
  const candidates = stations.map((station) => {
    const own = profiles.get(station.id)!;
    let reason = own.reason;
    if (!reason && station.id !== primaryId) {
      if (!primary?.interpretation || primary.reason)
        reason = 'primary-unavailable';
      else if (own.interpretation!.unit !== primary.interpretation.unit)
        reason = 'unit-mismatch';
      else if (
        JSON.stringify(own.interpretation) !==
        JSON.stringify(primary.interpretation)
      )
        reason = 'averaging-mismatch';
    }
    return { station, interpretation: own.interpretation, reason };
  });
  const timeline = hourlyTimeline(meta.window.from, windowHours);
  const series = ids.flatMap<AnalysisSeries>((id) => {
    const candidate = candidates.find((item) => item.station.id === id);
    if (!candidate) return [];
    const records = rows.get(id)!;
    if (candidate.reason)
      return [{ ...candidate, records, slots: [], summary: null }];
    const slots: SeriesSlot[] = timeline.map((at) => {
      const actual = records.filter(
        (row) => Date.parse(row.observedAt) === Date.parse(at),
      );
      const outside =
        Date.parse(at) < Date.parse(batch.window.from) ||
        Date.parse(at) >= Date.parse(batch.window.to);
      return {
        at,
        state:
          actual.length > 1
            ? 'conflict'
            : actual.length === 1
              ? actual[0]!.measurement.value === null
                ? 'null'
                : 'observed'
              : outside
                ? 'outside-coverage'
                : 'absent',
        observationIds: actual.map((row) => row.id),
      };
    });
    return [
      {
        ...candidate,
        records,
        slots,
        summary: summarizeSeries(slots, records),
      },
    ];
  });
  return {
    meta,
    acquisition: {
      label: batch.label,
      origin: batch.origin,
      sourceReference: batch.sourceReference,
    },
    windowHours,
    primaryId,
    missingStationIds: ids.filter((id) => !profiles.has(id)),
    candidates,
    series,
  };
}
