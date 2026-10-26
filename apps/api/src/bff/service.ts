import {
  datasetsResponseSchema,
  AREA_PRODUCT_CAPABILITIES,
  analysisSeriesResponseSchema,
  GREATER_LA,
  STUDY_REGIONS,
  selectStudyRegion,
  observationsResponseSchema,
  productsResponseSchema,
  regionsResponseSchema,
  stationIdSchema,
  stationsResponseSchema,
  stationReadingsResponseSchema,
  usageSummarySchema,
} from '@aq/contracts';
import type { Batch, DataMode, ErrorCode, ResponseMeta } from '@aq/contracts';
import { BatchCache } from './cache.js';
import type { CacheResult } from './cache.js';
import { BffError } from './errors.js';
import { canonical } from './normalize.js';
import { SAMPLE_END } from './providers.js';
import type { StationProvider } from './providers.js';
import {
  analysisQuerySchema,
  datasetsQuerySchema,
  stationQuerySchema,
  validate,
} from './query.js';
import { buildAnalysis } from './series.js';
import type { StationQuery } from './query.js';
import type { SnapshotStore } from './repository.js';
import { Usage } from './usage.js';
import { SOURCES } from './catalog.js';

export class BffService {
  constructor(
    private readonly options: {
      mode: DataMode;
      sample: StationProvider;
      live: StationProvider;
      snapshots: SnapshotStore;
      cache: BatchCache;
      usage: Usage;
      now?: () => number;
      hasAirNowKey?: boolean;
    },
  ) {}
  health() {
    const mode = this.options.mode;
    if (mode === 'sample')
      return {
        mode,
        state: 'available' as const,
        label:
          'SYNTHETIC SAMPLE station observations available through the read-only API.',
      };
    return {
      mode,
      state: 'unavailable' as const,
      reason:
        mode === 'historical'
          ? ('snapshot-required' as const)
          : this.options.hasAirNowKey
            ? ('provider-contract-unverified' as const)
            : ('provider-not-configured' as const),
    };
  }
  regions() {
    return regionsResponseSchema.parse({ data: STUDY_REGIONS });
  }
  products() {
    return productsResponseSchema.parse({
      data: [
        {
          id: 'monitoring-stations',
          product: 'observation',
          pollutants: ['PM2.5', 'O3', 'PM10'],
          measurementTypes: ['aqi', 'concentration'],
          modes: {
            sample: 'available',
            historical: 'identified-curated-snapshot-required',
            live: 'provider-contract-unverified',
          },
          maxWindowHours: 72,
        },
        ...AREA_PRODUCT_CAPABILITIES,
      ],
    });
  }
  usage() {
    return usageSummarySchema.parse(this.options.usage.summary());
  }
  async datasets(raw: unknown) {
    const query = validate(datasetsQuerySchema, raw);
    const metadata = {
      sources: SOURCES,
      sampleFixture: {
        id: 'synthetic-stations-v1',
        label: 'SYNTHETIC SAMPLE — fictional monitors',
        mode: 'sample',
        endAt: SAMPLE_END,
      },
    };
    try {
      return datasetsResponseSchema.parse({
        ...metadata,
        data: await this.options.snapshots.list(query),
        database: 'available',
        resultState: 'complete',
        warning: null,
      });
    } catch {
      return datasetsResponseSchema.parse({
        ...metadata,
        data: [],
        database: 'unavailable',
        resultState: 'partial',
        warning: 'DATABASE_UNAVAILABLE',
      });
    }
  }
  private async load(raw: unknown, partialHistoricalWindow = false) {
    const query = validate(stationQuerySchema, raw);
    const mode = query.mode ?? this.options.mode;
    if (mode === 'historical' && !query.snapshotId)
      throw new BffError('SNAPSHOT_REQUIRED', 400);
    if (mode !== 'historical' && query.snapshotId)
      throw new BffError('INVALID_REQUEST', 400);
    const now = (this.options.now ?? Date.now)();
    const to =
      query.endAt ??
      (mode === 'sample'
        ? new Date(SAMPLE_END).toISOString()
        : mode === 'live'
          ? new Date(
              Math.floor(now / 3_600_000) * 3_600_000 - 3_600_000,
            ).toISOString()
          : null);
    if (mode === 'live' && to && Date.parse(to) > now)
      throw new BffError('UNSUPPORTED_RANGE', 400);
    const from = to
      ? new Date(Date.parse(to) - query.windowHours * 3_600_000).toISOString()
      : null;
    if (from && Date.parse(from) < Date.parse('1970-01-01T00:00:00Z'))
      throw new BffError('UNSUPPORTED_RANGE', 400);
    // Sub-bboxes, station selection and pagination only filter a single region fetch.
    const key = canonical({
      mode,
      region: GREATER_LA.id,
      bbox: GREATER_LA.bbox,
      pollutant: query.pollutant,
      measurementType: query.measurementType,
      from,
      to: to ?? 'snapshot-end',
      windowHours: query.windowHours,
      snapshotId: query.snapshotId ?? null,
    });
    const cached = await this.options.cache.get(key, mode, async () => {
      if (mode === 'historical') {
        const batch = await this.options.snapshots.load(query.snapshotId!);
        if (
          batch.dataMode !== 'historical' ||
          batch.origin !== 'official-historical'
        )
          throw new BffError('SNAPSHOT_MODE_MISMATCH', 409);
        return {
          batch,
          snapshotId: query.snapshotId!,
          persistenceFailed: false,
        };
      }
      const batch = await (
        mode === 'sample' ? this.options.sample : this.options.live
      ).load({
        region: GREATER_LA.id,
        bbox: GREATER_LA.bbox,
        from: from!,
        to: to!,
        pollutant: query.pollutant,
        measurementType: query.measurementType,
      });
      if (batch.dataMode !== mode)
        throw new BffError('UPSTREAM_MALFORMED', 502);
      let snapshotId: string | null = null;
      let persistenceFailed = false;
      let persistenceError: ErrorCode | null = null;
      if (mode === 'live') {
        try {
          snapshotId = await this.options.snapshots.save(batch);
        } catch (error) {
          persistenceFailed = true;
          persistenceError =
            error instanceof BffError ? error.code : 'DATABASE_UNAVAILABLE';
        }
      }
      return {
        batch,
        snapshotId,
        persistenceFailed,
        ...(persistenceError ? { persistenceError } : {}),
      };
    });
    const effectiveTo = to ?? cached.batch.window.to;
    const effectiveFrom =
      from ??
      new Date(
        Date.parse(effectiveTo) - query.windowHours * 3_600_000,
      ).toISOString();
    if (
      mode === 'historical' &&
      ((!partialHistoricalWindow &&
        Date.parse(effectiveFrom) < Date.parse(cached.batch.window.from)) ||
        Date.parse(effectiveTo) <= Date.parse(cached.batch.window.from) ||
        Date.parse(effectiveTo) > Date.parse(cached.batch.window.to))
    )
      throw new BffError('UNSUPPORTED_RANGE', 400);
    const bbox = query.bbox ?? selectStudyRegion(query.region).bbox;
    const stationIds = new Set(
      cached.batch.stations
        .filter(
          (s) =>
            s.coordinate.longitude >= bbox.west &&
            s.coordinate.longitude <= bbox.east &&
            s.coordinate.latitude >= bbox.south &&
            s.coordinate.latitude <= bbox.north,
        )
        .map((s) => s.id),
    );
    const allObservations = cached.batch.observations.filter(
      (row) =>
        stationIds.has(row.stationId) &&
        row.measurement.pollutant === query.pollutant &&
        Date.parse(row.observedAt) >= Date.parse(effectiveFrom) &&
        Date.parse(row.observedAt) < Date.parse(effectiveTo),
    );
    const observations = allObservations.filter(
      (row) => row.measurement.kind === query.measurementType,
    );
    const present = new Set(observations.map((row) => row.stationId));
    const stations = cached.batch.stations.filter((station) =>
      present.has(station.id),
    );
    return {
      query,
      cached,
      observations,
      allObservations,
      stations,
      window: { from: effectiveFrom, to: effectiveTo },
      bbox,
      mode,
    };
  }
  private meta(
    input: {
      query: StationQuery;
      cached: CacheResult;
      mode: DataMode;
      bbox: typeof GREATER_LA.bbox;
      window: { from: string; to: string };
    },
    total: number,
    observations: Batch['observations'],
  ): ResponseMeta {
    const { query, cached, mode, bbox, window } = input;
    const warnings: ResponseMeta['warnings'] = [];
    if (cached.cache.status === 'stale') warnings.push('stale-data');
    if (cached.persistenceFailed) warnings.push('snapshot-not-persisted');
    if (observations.some((row) => row.measurement.value === null))
      warnings.push('missing-values');
    if (cached.batch.diagnostics.rejectedRows) warnings.push('rejected-rows');
    if (cached.batch.diagnostics.conflictingRows)
      warnings.push('conflicting-rows');
    const latestObservedAt = observations.length
      ? observations.reduce(
          (latest, row) =>
            Date.parse(row.observedAt) > Date.parse(latest)
              ? row.observedAt
              : latest,
          observations[0]!.observedAt,
        )
      : null;
    // Engineering warning relative to the requested end, not an AirNow SLA.
    const delayed =
      mode !== 'live' || latestObservedAt === null
        ? null
        : Date.parse(latestObservedAt) < Date.parse(window.to) - 2 * 3_600_000;
    if (delayed) warnings.push('delayed-observations');
    return {
      dataMode: mode,
      resultState:
        observations.length === 0
          ? 'empty'
          : cached.batch.resultState === 'partial' || warnings.length
            ? 'partial'
            : 'complete',
      region: query.region,
      bbox,
      pollutant: query.pollutant,
      measurementType: query.measurementType,
      window,
      fetchedAt: cached.batch.fetchedAt,
      sourceId: cached.batch.sourceId,
      snapshotId: cached.snapshotId,
      persistenceError: cached.persistenceError ?? null,
      diagnostics: cached.batch.diagnostics,
      availableCoverage: {
        bbox: cached.batch.bbox,
        window: cached.batch.window,
      },
      latestObservedAt,
      delayed,
      cache: cached.cache,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
        nextOffset:
          query.offset + query.limit < total
            ? query.offset + query.limit
            : null,
      },
      warnings,
    };
  }
  async stations(raw: unknown) {
    const result = await this.load(raw);
    return stationsResponseSchema.parse({
      data: result.stations.slice(
        result.query.offset,
        result.query.offset + result.query.limit,
      ),
      meta: this.meta(result, result.stations.length, result.observations),
    });
  }
  async stationReadings(raw: unknown) {
    const result = await this.load(raw);
    const byStation = new Map<string, Batch['observations']>();
    for (const row of result.allObservations) {
      const rows = byStation.get(row.stationId) ?? [];
      rows.push(row);
      byStation.set(row.stationId, rows);
    }
    const readings = result.cached.batch.stations
      .filter((station) => byStation.has(station.id))
      .map((station) => {
        const rows = byStation.get(station.id)!;
        const observations: Batch['observations'] = [];
        for (const kind of ['aqi', 'concentration'] as const) {
          const metric = rows.filter((row) => row.measurement.kind === kind);
          const latest = Math.max(
            ...metric.map((row) => Date.parse(row.observedAt)),
          );
          // Never fall back to an older non-null reading or select an arbitrary tie.
          observations.push(
            ...metric.filter((row) => Date.parse(row.observedAt) === latest),
          );
        }
        return {
          station,
          observations: observations.sort((a, b) => a.id.localeCompare(b.id)),
        };
      });
    return stationReadingsResponseSchema.parse({
      data: readings.slice(
        result.query.offset,
        result.query.offset + result.query.limit,
      ),
      meta: this.meta(result, readings.length, result.allObservations),
    });
  }
  async analysis(raw: unknown) {
    const { stationIds, ...query } = validate(analysisQuerySchema, raw);
    const result = await this.load(
      { ...query, windowHours: String(query.windowHours), limit: '256' },
      true,
    );
    return analysisSeriesResponseSchema.parse(
      buildAnalysis(
        result.cached.batch,
        result.observations,
        result.allObservations,
        this.meta(result, result.stations.length, result.observations),
        stationIds,
        query.windowHours,
      ),
    );
  }
  async observations(id: unknown, raw: unknown) {
    const stationId = validate(stationIdSchema, id);
    const result = await this.load(raw);
    const station = result.stations.find((s) => s.id === stationId);
    if (!station) throw new BffError('STATION_NOT_FOUND', 404);
    const observations = result.observations.filter(
      (row) => row.stationId === stationId,
    );
    return observationsResponseSchema.parse({
      data: {
        station,
        observations: observations.slice(
          result.query.offset,
          result.query.offset + result.query.limit,
        ),
      },
      meta: this.meta(result, observations.length, observations),
    });
  }
}
