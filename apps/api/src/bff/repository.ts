import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { batchSchema, snapshotSchema } from '@aq/contracts';
import type { Batch, DataMode, Snapshot } from '@aq/contracts';
import { BffError } from './errors.js';
import { hash } from './normalize.js';

export interface SnapshotStore {
  save(batch: Batch): Promise<string>;
  load(id: string): Promise<Batch>;
  list(options?: {
    mode?: DataMode | undefined;
    limit?: number;
    offset?: number;
  }): Promise<Snapshot[]>;
}
export const STORE_LIMITS = {
  snapshots: 32,
  sites: 512,
  observationsPerSnapshot: 2000,
} as const;
export class PgSnapshots implements SnapshotStore {
  constructor(private readonly pool?: Pool) {}
  async save(input: Batch): Promise<string> {
    const validated = batchSchema.safeParse(input);
    if (!validated.success) throw new BffError('UPSTREAM_MALFORMED', 400);
    const batch = validated.data;
    if (!this.pool) throw new BffError('DATABASE_UNAVAILABLE');
    let client;
    try {
      client = await this.pool.connect();
    } catch {
      throw new BffError('DATABASE_UNAVAILABLE');
    }
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query(
        'SELECT pg_advisory_xact_lock($1, $2)',
        [241025, 1002],
      );
      const checksum = hash(batch);
      const duplicate = await client.query<{ id: string }>(
        'SELECT id FROM aq_workbench.data_snapshots WHERE data_mode = $1 AND source_id = $2 AND content_hash = $3',
        [batch.dataMode, batch.sourceId, checksum],
      );
      if (duplicate.rows[0]) {
        await client.query('COMMIT');
        return duplicate.rows[0].id;
      }
      const capacity = await client.query<{
        snapshots: number;
        sites: number;
        new_sites: number;
      }>(
        `SELECT
        (SELECT count(*)::integer FROM aq_workbench.data_snapshots) AS snapshots,
        (SELECT count(*)::integer FROM aq_workbench.monitoring_sites) AS sites,
        (SELECT count(*)::integer FROM unnest($1::text[]) AS incoming(id) WHERE NOT EXISTS (SELECT 1 FROM aq_workbench.monitoring_sites existing WHERE existing.id = incoming.id)) AS new_sites`,
        [batch.stations.map((site) => site.id)],
      );
      const counts = capacity.rows[0]!;
      if (
        counts.snapshots >= STORE_LIMITS.snapshots ||
        counts.sites + counts.new_sites > STORE_LIMITS.sites
      )
        throw new BffError('STORAGE_LIMIT', 409);
      const sites = batch.stations.map((site) => ({
        id: site.id,
        provider: site.identity.provider,
        native_site_id: site.identity.nativeSiteId,
        monitor_identity: site.identity.monitorId ?? '',
        parameter_identity: site.identity.parameterId ?? '',
        longitude: site.coordinate.longitude,
        latitude: site.coordinate.latitude,
        payload: site,
      }));
      await client.query(
        `INSERT INTO aq_workbench.monitoring_sites (id, provider, native_site_id, monitor_identity, parameter_identity, longitude, latitude, payload)
        SELECT id, provider, native_site_id, monitor_identity, parameter_identity, longitude, latitude, payload
        FROM jsonb_to_recordset($1::jsonb) AS s(id text, provider text, native_site_id text, monitor_identity text, parameter_identity text, longitude double precision, latitude double precision, payload jsonb)
        ON CONFLICT (id) DO UPDATE SET longitude = excluded.longitude, latitude = excluded.latitude, payload = excluded.payload`,
        [JSON.stringify(sites)],
      );
      const id = randomUUID();
      // Snapshot-time station metadata is immutable here; registry updates cannot rewrite it.
      const metadata = { ...batch, observations: [] };
      await client.query(
        `INSERT INTO aq_workbench.data_snapshots
        (id, source_id, data_mode, origin, label, captured_at, window_start, window_end, result_state, observation_count, content_hash, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [
          id,
          batch.sourceId,
          batch.dataMode,
          batch.origin,
          batch.label,
          batch.fetchedAt,
          batch.window.from,
          batch.window.to,
          batch.resultState,
          batch.observations.length,
          checksum,
          JSON.stringify(metadata),
        ],
      );
      const rows = batch.observations.map((row) => ({
        id: row.id,
        station_id: row.stationId,
        pollutant: row.measurement.pollutant,
        measurement_type: row.measurement.kind,
        observed_at: row.observedAt,
        unit: row.measurement.unit,
        value: row.measurement.value,
        raw_value: row.raw.value,
        period_key: hash(row.period),
        payload: row,
      }));
      await client.query(
        `INSERT INTO aq_workbench.observations (snapshot_id, id, station_id, pollutant, measurement_type, observed_at, unit, value, raw_value, period_key, payload)
        SELECT $1::uuid, id, station_id, pollutant, measurement_type, observed_at::timestamptz, unit, value, raw_value, period_key, payload
        FROM jsonb_to_recordset($2::jsonb) AS o(id text, station_id text, pollutant text, measurement_type text, observed_at text, unit text, value double precision, raw_value double precision, period_key text, payload jsonb)`,
        [id, JSON.stringify(rows)],
      );
      await client.query(
        'INSERT INTO aq_workbench.snapshot_imports (snapshot_id, method, source_reference, diagnostics) VALUES ($1,$2,$3,$4::jsonb)',
        [
          id,
          batch.importMethod,
          batch.sourceReference,
          JSON.stringify(batch.diagnostics),
        ],
      );
      await client.query('COMMIT');
      return id;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error instanceof BffError
        ? error
        : new BffError('DATABASE_UNAVAILABLE');
    } finally {
      client.release();
    }
  }
  async load(id: string): Promise<Batch> {
    if (!this.pool) throw new BffError('DATABASE_UNAVAILABLE');
    try {
      const metadata = await this.pool.query<{ metadata: unknown }>(
        'SELECT metadata FROM aq_workbench.data_snapshots WHERE id = $1::uuid',
        [id],
      );
      if (!metadata.rows[0]) throw new BffError('SNAPSHOT_NOT_FOUND', 404);
      const rows = await this.pool.query<{ payload: unknown }>(
        'SELECT payload FROM aq_workbench.observations WHERE snapshot_id = $1::uuid ORDER BY observed_at, id LIMIT $2',
        [id, STORE_LIMITS.observationsPerSnapshot + 1],
      );
      return batchSchema.parse({
        ...(metadata.rows[0].metadata as Record<string, unknown>),
        observations: rows.rows.map((row) => row.payload),
      });
    } catch (error) {
      throw error instanceof BffError
        ? error
        : new BffError('DATABASE_UNAVAILABLE');
    }
  }
  async list(
    options: {
      mode?: DataMode | undefined;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Snapshot[]> {
    if (!this.pool) throw new BffError('DATABASE_UNAVAILABLE');
    try {
      const result = await this.pool.query(
        `SELECT id, source_id AS "sourceId", data_mode AS "dataMode", origin, label, captured_at AS "capturedAt", window_start, window_end, observation_count AS "observationCount", result_state AS "resultState", metadata->'bbox' AS bbox, metadata->>'region' AS region, metadata->>'sourceReference' AS "sourceReference"
        FROM aq_workbench.data_snapshots WHERE ($1::text IS NULL OR data_mode = $1) ORDER BY captured_at DESC, id LIMIT $2 OFFSET $3`,
        [
          options.mode ?? null,
          Math.min(20, options.limit ?? 20),
          Math.min(31, options.offset ?? 0),
        ],
      );
      return result.rows.map((row) =>
        snapshotSchema.parse({
          id: row.id,
          sourceId: row.sourceId,
          dataMode: row.dataMode,
          origin: row.origin,
          label: row.label,
          capturedAt: row.capturedAt.toISOString(),
          window: {
            from: row.window_start.toISOString(),
            to: row.window_end.toISOString(),
          },
          observationCount: row.observationCount,
          resultState: row.resultState,
          bbox: row.bbox,
          region: row.region,
          sourceReference: row.sourceReference,
        }),
      );
    } catch {
      throw new BffError('DATABASE_UNAVAILABLE');
    }
  }
}
