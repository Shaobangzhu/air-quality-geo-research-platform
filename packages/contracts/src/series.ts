import { z } from 'zod';
import {
  observationSchema,
  publicSourceReferenceSchema,
  responseMetaSchema,
  stationIdSchema,
  stationSchema,
} from './bff.js';
import { utcTimestampSchema } from './domain.js';
import type { Observation } from './bff.js';

export const analysisWindowSchema = z.union([
  z.literal(24),
  z.literal(48),
  z.literal(72),
]);
export const seriesReasonSchema = z.enum([
  'measurement-unavailable',
  'units-inconsistent',
  'averaging-unverified',
  'averaging-inconsistent',
  'unit-mismatch',
  'averaging-mismatch',
  'primary-unavailable',
]);
export const interpretationSchema = z.strictObject({
  unit: z.enum(['AQI', 'µg/m³', 'ppm', 'ppb']),
  alignment: z.enum(['interval-start', 'interval-end']),
  averagingDescription: z.string().min(1).max(500),
  sourceTimeZone: z.string().min(1).max(100),
});
export type Interpretation = z.infer<typeof interpretationSchema>;
export function observationInterpretation(
  row: Observation,
): Interpretation | null {
  const { startsAt, endsAt } = row.period;
  if (
    row.period.meaning !== 'hourly' ||
    !startsAt ||
    !endsAt ||
    Date.parse(endsAt) - Date.parse(startsAt) !== 3_600_000 ||
    Date.parse(row.observedAt) % 3_600_000 !== 0
  )
    return null;
  const at = Date.parse(row.observedAt);
  const alignment =
    at === Date.parse(startsAt)
      ? 'interval-start'
      : at === Date.parse(endsAt)
        ? 'interval-end'
        : null;
  return alignment
    ? {
        unit: row.measurement.unit,
        alignment,
        averagingDescription: row.period.averagingDescription,
        sourceTimeZone: row.period.sourceTimeZone,
      }
    : null;
}
export function hourlyTimeline(from: string, hours: number): string[] {
  const start = Date.parse(utcTimestampSchema.parse(from));
  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 72 ||
    start % 3_600_000 !== 0
  )
    throw new Error('Invalid hourly timeline.');
  return Array.from({ length: hours }, (_, index) =>
    new Date(start + index * 3_600_000).toISOString(),
  );
}
export const slotSchema = z.strictObject({
  at: utcTimestampSchema,
  state: z.enum(['observed', 'null', 'absent', 'outside-coverage', 'conflict']),
  observationIds: z.array(z.string().regex(/^o_[a-f0-9]{40}$/)).max(2000),
});
export type SeriesSlot = z.infer<typeof slotSchema>;
export const seriesSummarySchema = z.strictObject({
  availableCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  nullCount: z.number().int().nonnegative(),
  outsideCoverageCount: z.number().int().nonnegative(),
  conflictCount: z.number().int().nonnegative(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  peakAt: utcTimestampSchema.nullable(),
});
export function summarizeSeries(slots: SeriesSlot[], records: Observation[]) {
  const byId = new Map(records.map((row) => [row.id, row]));
  const actual = slots.flatMap((slot) => {
    const record =
      slot.state === 'observed' ? byId.get(slot.observationIds[0]!) : undefined;
    return record && record.measurement.value !== null
      ? [{ at: record.observedAt, value: record.measurement.value }]
      : [];
  });
  const min = actual.length
    ? Math.min(...actual.map((row) => row.value))
    : null;
  const max = actual.length
    ? Math.max(...actual.map((row) => row.value))
    : null;
  const peaks = actual.filter((row) => row.value === max);
  const count = (state: SeriesSlot['state']) =>
    slots.filter((slot) => slot.state === state).length;
  const absentCount = count('absent'),
    nullCount = count('null'),
    outsideCoverageCount = count('outside-coverage');
  return {
    availableCount: actual.length,
    missingCount: absentCount + nullCount + outsideCoverageCount,
    absentCount,
    nullCount,
    outsideCoverageCount,
    conflictCount: count('conflict'),
    min,
    max,
    peakAt:
      peaks.length === 1 && !slots.some((slot) => slot.state === 'conflict')
        ? peaks[0]!.at
        : null,
  };
}
const candidateSchema = z.strictObject({
  station: stationSchema,
  interpretation: interpretationSchema.nullable(),
  reason: seriesReasonSchema.nullable(),
});
export const analysisSeriesResponseSchema = z
  .strictObject({
    meta: responseMetaSchema,
    acquisition: z.strictObject({
      label: z.string().min(1).max(160),
      origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
      sourceReference: publicSourceReferenceSchema,
    }),
    windowHours: analysisWindowSchema,
    primaryId: stationIdSchema.nullable(),
    missingStationIds: z.array(stationIdSchema).max(3),
    candidates: z.array(candidateSchema).max(256),
    series: z
      .array(
        candidateSchema.extend({
          records: z.array(observationSchema).max(2000),
          slots: z.array(slotSchema).max(72),
          summary: seriesSummarySchema.nullable(),
        }),
      )
      .max(3),
  })
  .superRefine((result, ctx) => {
    const issue = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid bounded analysis context.',
      });
    const { meta } = result;
    if (
      Date.parse(meta.window.from) % 3_600_000 !== 0 ||
      Date.parse(meta.window.to) - Date.parse(meta.window.from) !==
        result.windowHours * 3_600_000
    ) {
      issue();
      return;
    }
    const timeline = hourlyTimeline(meta.window.from, result.windowHours);
    const candidates = new Set(result.candidates.map((row) => row.station.id));
    if (
      result.series.length + result.missingStationIds.length > 3 ||
      new Set(result.missingStationIds).size !==
        result.missingStationIds.length ||
      candidates.size !== result.candidates.length ||
      new Set(result.series.map((row) => row.station.id)).size !==
        result.series.length ||
      result.missingStationIds.some((id) => candidates.has(id))
    )
      issue();
    if (
      meta.dataMode === 'sample'
        ? result.acquisition.origin !== 'synthetic' ||
          !result.acquisition.label.startsWith('SYNTHETIC SAMPLE')
        : result.acquisition.origin !==
          (meta.dataMode === 'live' ? 'provider-live' : 'official-historical')
    )
      issue();
    for (const candidate of result.candidates) {
      const expectedProvider =
        meta.sourceId === 'synthetic-stations-v1'
          ? 'synthetic'
          : meta.sourceId === 'airnow-hourly'
            ? 'airnow'
            : 'aqs';
      if (
        candidate.station.identity.provider !== expectedProvider ||
        (meta.dataMode === 'sample') !==
          candidate.station.identity.nativeSiteId.startsWith('SAMPLE-') ||
        (!candidate.interpretation && !candidate.reason)
      )
        issue();
      const { longitude, latitude } = candidate.station.coordinate;
      if (
        longitude < meta.bbox.west ||
        longitude > meta.bbox.east ||
        latitude < meta.bbox.south ||
        latitude > meta.bbox.north
      )
        issue();
    }
    const primary = result.series.find(
      (row) => row.station.id === result.primaryId,
    );
    if (
      result.primaryId
        ? !primary && !result.missingStationIds.includes(result.primaryId)
        : result.series.length > 0
    )
      issue();
    let recordCount = 0;
    for (const item of result.series) {
      if (!candidates.has(item.station.id)) issue();
      const records = new Map(item.records.map((row) => [row.id, row]));
      recordCount += records.size;
      if (records.size !== item.records.length) issue();
      for (const row of item.records) {
        if (
          (meta.dataMode === 'sample'
            ? !item.station.identity.nativeSiteId.startsWith('SAMPLE-') ||
              item.station.identity.provider !== 'synthetic'
            : item.station.identity.nativeSiteId.startsWith('SAMPLE-') ||
              item.station.identity.provider === 'synthetic') ||
          Date.parse(row.fetchedAt) !== Date.parse(meta.fetchedAt) ||
          row.provenance.label !== result.acquisition.label ||
          row.provenance.sourceReference !== result.acquisition.sourceReference
        )
          issue();
        if (
          row.stationId !== item.station.id ||
          row.measurement.pollutant !== meta.pollutant ||
          row.measurement.kind !== meta.measurementType ||
          row.dataMode !== meta.dataMode ||
          row.provenance.origin !== result.acquisition.origin ||
          row.provenance.sourceId !== meta.sourceId ||
          row.provenance.transportProvider !== item.station.identity.provider ||
          row.provenance.sourceAgency !== item.station.sourceAgency ||
          Date.parse(row.observedAt) < Date.parse(meta.window.from) ||
          Date.parse(row.observedAt) >= Date.parse(meta.window.to)
        )
          issue();
      }
      if (item.reason) {
        if (item.slots.length || item.summary !== null) issue();
        continue;
      }
      if (
        !item.interpretation ||
        !primary?.interpretation ||
        JSON.stringify(item.interpretation) !==
          JSON.stringify(primary.interpretation) ||
        item.slots.length !== timeline.length
      )
        issue();
      const seen = new Set<string>();
      item.slots.forEach((slot, index) => {
        if (Date.parse(slot.at) !== Date.parse(timeline[index]!)) issue();
        const rows = slot.observationIds.map((id) => records.get(id));
        for (const row of rows) {
          if (
            !row ||
            seen.has(row.id) ||
            Date.parse(row.observedAt) !== Date.parse(slot.at) ||
            JSON.stringify(observationInterpretation(row)) !==
              JSON.stringify(item.interpretation)
          )
            issue();
          if (row) seen.add(row.id);
        }
        const expected =
          rows.length > 1
            ? 'conflict'
            : rows.length === 1
              ? rows[0]?.measurement.value === null
                ? 'null'
                : 'observed'
              : Date.parse(slot.at) <
                    Date.parse(meta.availableCoverage.window.from) ||
                  Date.parse(slot.at) >=
                    Date.parse(meta.availableCoverage.window.to)
                ? 'outside-coverage'
                : 'absent';
        if (slot.state !== expected) issue();
      });
      if (
        seen.size !== records.size ||
        JSON.stringify(item.summary) !==
          JSON.stringify(summarizeSeries(item.slots, item.records))
      )
        issue();
    }
    if (recordCount > 2000) issue();
  });
export type AnalysisSeriesResponse = z.infer<
  typeof analysisSeriesResponseSchema
>;
export type AnalysisSeries = AnalysisSeriesResponse['series'][number];
export type SeriesReason = z.infer<typeof seriesReasonSchema>;
