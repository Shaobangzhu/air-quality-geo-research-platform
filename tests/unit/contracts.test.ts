import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  bboxSchema,
  coordinateSchema,
  dataAvailabilitySchema,
  dataModeSchema,
  forecastSchema,
  GREATER_LA,
  isWithinStudyExtent,
  measurementSchema,
  monitoringSiteSchema,
  reportingAreaObservationSchema,
  sampleFixtureSchema,
  selectStudyRegion,
  siteObservationSchema,
  utcTimestampSchema,
} from '@aq/contracts';

const fixture: unknown = JSON.parse(
  await readFile(
    new URL('../../fixtures/synthetic/site-observations.json', import.meta.url),
    'utf8',
  ),
);
const sample = sampleFixtureSchema.parse(fixture);
const first = sample.observations[0]!;

describe('geographic boundaries', () => {
  it.each([
    { longitude: 181, latitude: 34 },
    { longitude: -118, latitude: 91 },
    { longitude: NaN, latitude: 34 },
    { longitude: Infinity, latitude: 34 },
  ])('rejects invalid WGS84: %j', (point) => {
    expect(coordinateSchema.safeParse(point).success).toBe(false);
  });
  it.each([
    { west: 1, east: 0, south: 0, north: 1 },
    { west: 0, east: 1, south: 1, north: 0 },
    { west: 1, east: 1, south: 0, north: 1 },
  ])('rejects inverted or empty bbox: %j', (box) => {
    expect(bboxSchema.safeParse(box).success).toBe(false);
  });
  it('selects only the frozen engineering extent and includes its boundary', () => {
    expect(selectStudyRegion('greater-la').bbox).toEqual({
      west: -119.05,
      south: 33.35,
      east: -116.7,
      north: 34.6,
    });
    expect(() => selectStudyRegion('south-coast-air-basin')).toThrow();
    expect(
      isWithinStudyExtent({
        longitude: GREATER_LA.bbox.west,
        latitude: GREATER_LA.bbox.north,
      }),
    ).toBe(true);
    expect(isWithinStudyExtent({ longitude: -122, latitude: 34 })).toBe(false);
  });
});
describe('scientific semantics', () => {
  it('retains leading-zero string IDs and rejects numeric IDs', () => {
    expect(monitoringSiteSchema.parse({ ...first.site, id: '0014' }).id).toBe(
      '0014',
    );
    expect(
      monitoringSiteSchema.safeParse({ ...first.site, id: 14 }).success,
    ).toBe(false);
  });
  it('keeps AQI separate from concentration and validates units', () => {
    expect(
      measurementSchema.parse({
        kind: 'aqi',
        pollutant: 'O3',
        value: 42,
        unit: 'AQI',
      }).value,
    ).toBe(42);
    expect(
      measurementSchema.safeParse({
        kind: 'aqi',
        pollutant: 'O3',
        value: 42,
        unit: 'ppm',
      }).success,
    ).toBe(false);
    expect(
      measurementSchema.safeParse({
        kind: 'concentration',
        pollutant: 'PM2.5',
        value: 1,
        unit: 'ppb',
      }).success,
    ).toBe(false);
    expect(
      measurementSchema.safeParse({
        kind: 'aqi',
        pollutant: 'PM10',
        value: -1,
        unit: 'AQI',
      }).success,
    ).toBe(false);
  });
  it('preserves negative concentrations, missing values and zero without coercion', () => {
    expect(first.raw.value).toBe(-0.2);
    expect(first.measurement.value).toBe(-0.2);
    expect(sample.observations[1]!.measurement.value).toBeNull();
    expect(sample.observations[2]!.measurement.value).toBe(0);
    expect(
      measurementSchema.safeParse({
        kind: 'concentration',
        pollutant: 'O3',
        value: '0',
        unit: 'ppb',
      }).success,
    ).toBe(false);
  });
  it.each([
    '2026-01-15T12:00:00-08:00',
    '2026-01-15T20:00:00',
    '2026-02-30T20:00:00Z',
  ])('requires valid UTC timestamps: %s', (timestamp) => {
    expect(utcTimestampSchema.safeParse(timestamp).success).toBe(false);
  });
  it('does not conflate reporting areas, sites, observations and forecasts', () => {
    expect(siteObservationSchema.parse(first).product).toBe('observation');
    expect(reportingAreaObservationSchema.safeParse(first).success).toBe(false);
    expect(forecastSchema.safeParse(first).success).toBe(false);
    expect(
      siteObservationSchema.safeParse({ ...first, product: 'forecast' })
        .success,
    ).toBe(false);
  });
  it('requires ordered averaging intervals', () => {
    expect(
      siteObservationSchema.safeParse({
        ...first,
        period: {
          ...first.period,
          startsAt: first.period.endsAt,
          endsAt: first.period.startsAt,
        },
      }).success,
    ).toBe(false);
  });
  it('makes unavailable a state inside a mode', () => {
    expect(dataModeSchema.safeParse('unavailable').success).toBe(false);
    expect(
      dataAvailabilitySchema.parse({
        mode: 'live',
        state: 'unavailable',
        reason: 'foundation-only',
      }).state,
    ).toBe('unavailable');
  });
  it('requires unmistakably synthetic fixtures within the study extent', () => {
    expect(
      sample.observations.every((row) =>
        isWithinStudyExtent(row.site.coordinate),
      ),
    ).toBe(true);
    expect(
      sampleFixtureSchema.safeParse({ ...sample, label: 'Historical data' })
        .success,
    ).toBe(false);
    expect(
      sampleFixtureSchema.safeParse({
        ...sample,
        observations: [
          { ...first, site: { ...first.site, id: 'official-looking-id' } },
        ],
      }).success,
    ).toBe(false);
    expect(
      sampleFixtureSchema.safeParse({
        ...sample,
        observations: [
          {
            ...first,
            provenance: { ...first.provenance, origin: 'official-historical' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
