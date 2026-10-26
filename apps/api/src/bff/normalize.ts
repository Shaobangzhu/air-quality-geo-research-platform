import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  batchSchema,
  bboxSchema,
  coordinateSchema,
  dataModeSchema,
  GREATER_LA,
  measurementSchema,
  periodSchema,
  publicSourceReferenceSchema,
  rawMeasurementSchema,
  sourceIdSchema,
  stationIdentitySchema,
  utcTimestampSchema,
  validationStatusSchema,
} from '@aq/contracts';
import type {
  Batch,
  Observation,
  Station,
  StationIdentity,
} from '@aq/contracts';
import { BffError } from './errors.js';
import { normalizePollutant } from './pollutants.js';

// Application import format only. These are not asserted to be AirNow wire fields.
export const importRowSchema = z.strictObject({
  identity: stationIdentitySchema,
  name: z.string().min(1).max(200),
  coordinate: coordinateSchema,
  sourceAgency: z.string().min(1).max(200),
  observedAt: utcTimestampSchema,
  period: periodSchema.refine(
    (period) =>
      period.averagingDescription.length <= 500 &&
      period.sourceTimeZone.length <= 100,
  ),
  measurement: measurementSchema,
  raw: rawMeasurementSchema.refine(
    (raw) =>
      raw.unit.length <= 32 &&
      raw.parameter.length <= 60 &&
      (raw.qualifier?.length ?? 0) <= 200,
  ),
  dataStatus: validationStatusSchema,
});
export const importManifestSchema = z.strictObject({
  format: z.literal('aq-workbench-import-v1'),
  dataMode: dataModeSchema,
  sourceId: sourceIdSchema,
  region: z.literal('greater-la'),
  bbox: bboxSchema.refine(
    (b) =>
      b.west >= GREATER_LA.bbox.west &&
      b.east <= GREATER_LA.bbox.east &&
      b.south >= GREATER_LA.bbox.south &&
      b.north <= GREATER_LA.bbox.north,
  ),
  window: z.strictObject({ from: utcTimestampSchema, to: utcTimestampSchema }),
  fetchedAt: utcTimestampSchema,
  origin: z.enum(['synthetic', 'official-historical', 'provider-live']),
  label: z.string().min(1).max(160),
  sourceReference: publicSourceReferenceSchema,
  importMethod: z.enum(['fixture', 'curated-file', 'live-fetch']),
  rows: z.array(z.unknown()).max(2000),
});
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function stationId(identity: StationIdentity): string {
  return `s_${hash(identity).slice(0, 32)}`;
}

export function normalizeImport(input: unknown, secrets: string[] = []): Batch {
  // Reject reflected credentials without emitting, storing or forwarding the raw input.
  const serialized = JSON.stringify(input);
  if (
    !serialized ||
    Buffer.byteLength(serialized) > 2_000_000 ||
    /[?&](?:api_?key|key|token|signature|email)=/i.test(serialized) ||
    secrets.some((secret) => secret.length > 0 && serialized.includes(secret))
  )
    throw new BffError('UPSTREAM_MALFORMED', 502);
  const parsed = importManifestSchema.safeParse(input);
  if (!parsed.success) throw new BffError('UPSTREAM_MALFORMED', 502);
  const manifest = parsed.data;
  const stations = new Map<string, Station>();
  const observations = new Map<string, Observation>();
  const logical = new Set<string>();
  const diagnostics = {
    inputRows: manifest.rows.length,
    rejectedRows: 0,
    duplicateRows: 0,
    conflictingRows: 0,
    missingValues: 0,
    rejectedRowIndexes: [] as number[],
  };
  manifest.rows.forEach((candidate, index) => {
    const parsedRow = importRowSchema.safeParse(candidate);
    if (!parsedRow.success) {
      diagnostics.rejectedRows++;
      if (diagnostics.rejectedRowIndexes.length < 20)
        diagnostics.rejectedRowIndexes.push(index);
      return;
    }
    const row = parsedRow.data;
    const aqsPollutant =
      row.identity.provider === 'aqs'
        ? normalizePollutant(row.raw.parameter, 'aqs')
        : undefined;
    if (aqsPollutant && aqsPollutant !== row.measurement.pollutant) {
      diagnostics.rejectedRows++;
      if (diagnostics.rejectedRowIndexes.length < 20)
        diagnostics.rejectedRowIndexes.push(index);
      return;
    }
    const id = stationId(row.identity);
    const station: Station = {
      id,
      identity: row.identity,
      name: row.name,
      coordinate: row.coordinate,
      sourceAgency: row.sourceAgency,
    };
    const b = manifest.bbox;
    const outside =
      row.coordinate.longitude < b.west ||
      row.coordinate.longitude > b.east ||
      row.coordinate.latitude < b.south ||
      row.coordinate.latitude > b.north ||
      Date.parse(row.observedAt) < Date.parse(manifest.window.from) ||
      Date.parse(row.observedAt) >= Date.parse(manifest.window.to);
    if (
      outside ||
      (stations.has(id) && canonical(stations.get(id)) !== canonical(station))
    ) {
      diagnostics.rejectedRows++;
      if (diagnostics.rejectedRowIndexes.length < 20)
        diagnostics.rejectedRowIndexes.push(index);
      return;
    }
    const logicalKey = hash({
      stationId: id,
      observedAt: row.observedAt,
      period: row.period,
      kind: row.measurement.kind,
      pollutant: row.measurement.pollutant,
      unit: row.measurement.unit,
    });
    const revision = `o_${hash({ logicalKey, measurement: row.measurement, raw: row.raw, dataStatus: row.dataStatus, sourceAgency: row.sourceAgency }).slice(0, 40)}`;
    if (observations.has(revision)) {
      diagnostics.duplicateRows++;
      return;
    }
    if (logical.has(logicalKey)) diagnostics.conflictingRows++;
    logical.add(logicalKey);
    stations.set(id, station);
    if (row.measurement.value === null) diagnostics.missingValues++;
    observations.set(revision, {
      id: revision,
      stationId: id,
      product: 'observation',
      observedAt: row.observedAt,
      fetchedAt: manifest.fetchedAt,
      period: row.period,
      measurement: row.measurement,
      raw: row.raw,
      dataStatus: row.dataStatus,
      dataMode: manifest.dataMode,
      provenance: {
        sourceId: manifest.sourceId,
        transportProvider: row.identity.provider,
        sourceAgency: row.sourceAgency,
        sourceReference: manifest.sourceReference,
        origin: manifest.origin,
        label: manifest.label,
      },
    });
  });
  if (manifest.rows.length > 0 && observations.size === 0)
    throw new BffError('UPSTREAM_MALFORMED', 502);
  const metadata = {
    dataMode: manifest.dataMode,
    sourceId: manifest.sourceId,
    region: manifest.region,
    bbox: manifest.bbox,
    window: manifest.window,
    fetchedAt: manifest.fetchedAt,
    origin: manifest.origin,
    label: manifest.label,
    sourceReference: manifest.sourceReference,
    importMethod: manifest.importMethod,
  };
  const result = batchSchema.safeParse({
    ...metadata,
    stations: [...stations.values()].sort((a, b) => a.id.localeCompare(b.id)),
    observations: [...observations.values()].sort(
      (a, b) =>
        a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id),
    ),
    diagnostics,
    resultState:
      observations.size === 0
        ? 'empty'
        : diagnostics.rejectedRows ||
            diagnostics.conflictingRows ||
            diagnostics.missingValues
          ? 'partial'
          : 'complete',
  });
  if (!result.success) throw new BffError('UPSTREAM_MALFORMED', 502);
  return result.data;
}
