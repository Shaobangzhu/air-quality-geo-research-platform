import { expect, it } from 'vitest';
import {
  aqiCategory,
  concentrationBins,
  formatLocalTime,
  readingStyle,
} from './station-presentation.js';
import { harness } from '../../../../tests/helpers/bff.js';
import fixture from '../../../../fixtures/synthetic/bff-hourly.json';
import { SampleProvider } from '../../../api/src/bff/providers.js';
const response = () =>
  harness({ sample: new SampleProvider(fixture) }).service.stationReadings({
    mode: 'sample',
  });
it('uses supplied AQI values at each official category boundary, including true zero', () => {
  for (const [value, label] of [
    [0, 'Good'],
    [50, 'Good'],
    [51, 'Moderate'],
    [100, 'Moderate'],
    [101, 'Unhealthy for Sensitive Groups'],
    [150, 'Unhealthy for Sensitive Groups'],
    [151, 'Unhealthy'],
    [200, 'Unhealthy'],
    [201, 'Very Unhealthy'],
    [300, 'Very Unhealthy'],
    [301, 'Hazardous'],
    [501, 'Hazardous'],
  ] as const)
    expect(aqiCategory(value)?.label).toBe(label);
  expect(aqiCategory(null)).toBeUndefined();
  expect(aqiCategory(-1)).toBeUndefined();
  expect(aqiCategory(2.3)).toBeUndefined();
});
it('keeps independent concentration units/bins and preserves negative readings', async () => {
  expect(concentrationBins('O3', 'ppm')[0]!.max).toBe(0.025);
  expect(concentrationBins('O3', 'ppb')[0]!.max).toBe(25);
  const result = await response();
  const reading = result.data[0]!;
  const row = reading.observations.find(
    (item) => item.measurement.kind === 'concentration',
  )!;
  row.measurement.value = -0.2;
  expect(readingStyle(reading, result.meta, 'concentration')).toMatchObject({
    style: 'triangle',
    label: expect.stringContaining('-0.2 µg/m³'),
  });
  row.measurement.value = 0;
  expect(readingStyle(reading, result.meta, 'concentration')).toMatchObject({
    style: 'circle',
    label: '0 µg/m³',
  });
  expect(readingStyle(reading, result.meta, 'concentration').color).not.toBe(
    aqiCategory(0)?.color,
  );
});
it('uses neutral symbols for missing, stale, delayed and ambiguous observations without hiding the supplied records', async () => {
  const result = await response();
  const reading = result.data[0]!;
  const row = reading.observations.find(
    (item) => item.measurement.kind === 'aqi',
  )!;
  row.measurement.value = null;
  expect(readingStyle(reading, result.meta, 'aqi').style).toBe('diamond');
  row.measurement.value = 0;
  result.meta.cache.status = 'stale';
  expect(readingStyle(reading, result.meta, 'aqi').label).toBe(
    'Stale observation',
  );
  result.meta.cache.status = 'hit';
  result.meta.dataMode = 'live';
  result.meta.window.to = '2026-01-16T00:00:00Z';
  expect(readingStyle(reading, result.meta, 'aqi').label).toBe(
    'Stale observation',
  );
  result.meta.dataMode = 'sample';
  reading.observations.push({
    ...row,
    id: `o_${'f'.repeat(40)}`,
    period: { ...row.period, meaning: 'unknown' },
  });
  expect(readingStyle(reading, result.meta, 'aqi').label).toContain(
    'Multiple periods',
  );
  expect(row.measurement.value).toBe(0);
});
it('displays America/Los_Angeles with the correct winter/summer offset', () => {
  expect(formatLocalTime('2026-01-15T17:00:00Z')).toMatch(/09:00 PST/);
  expect(formatLocalTime('2026-07-15T17:00:00Z')).toMatch(/10:00 PDT/);
});
