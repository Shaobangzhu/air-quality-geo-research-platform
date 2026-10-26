import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from '../../../../fixtures/synthetic/bff-hourly.json';
import { harness } from '../../../../tests/helpers/bff.js';
import { SampleProvider } from '../../../api/src/bff/providers.js';
import { App } from '../App.js';
import { parseRoute, routeSearch } from '../route-state.js';
import { chartRows } from './presentation.js';
const setup = () => harness({ sample: new SampleProvider(fixture) });
beforeEach(() => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  window.history.replaceState({}, '', '/analysis?mode=sample');
  const h = setup();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.startsWith('/api/analysis-series')
          ? h.service.analysis(
              Object.fromEntries(new URL(url, 'http://localhost').searchParams),
            )
          : h.service.stationReadings(
              Object.fromEntries(new URL(url, 'http://localhost').searchParams),
            ),
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

it('renders an actual sparse chart, source summary and keyboard inspection with no hover/inspection fetch', async () => {
  render(<App />);
  const inspector = await screen.findByLabelText('Inspect observation time');
  expect(screen.getByLabelText('Observation window')).toHaveValue('24');
  expect(screen.queryByText('7D')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Series legend')).toHaveTextContent(
    'Solid line',
  );
  const summary = screen.getByRole('region', { name: 'Analysis summary' });
  expect(summary).toHaveTextContent('Outside source coverage');
  const count = vi.mocked(fetch).mock.calls.length;
  fireEvent.change(inspector, { target: { value: '0' } });
  expect(
    screen.getByRole('region', { name: 'Observation inspection' }),
  ).toHaveTextContent('No observation supplied');
  fireEvent.click(screen.getByRole('button', { name: 'Next hour' }));
  expect(fetch).toHaveBeenCalledTimes(count);
  expect(
    screen.getByText(/Synthetic sample · fictional monitors/),
  ).toBeVisible();
});
it('preserves the exact primary Map identity, makes windows deep-linkable and limits comparison to three', async () => {
  const h = setup();
  const discovery = await h.service.stationReadings({ mode: 'sample' });
  const primary = discovery.data.find(
    (item) =>
      item.station.identity.monitorId === '00A' &&
      item.station.identity.nativeSiteId === 'SAMPLE-00001',
  )!;
  window.history.replaceState(
    {},
    '',
    `/analysis?stationId=${primary.station.id}&mode=sample`,
  );
  render(<App />);
  await screen.findByLabelText('Inspect observation time');
  expect(screen.getByLabelText('Primary monitoring station')).toHaveValue(
    primary.station.id,
  );
  fireEvent.change(screen.getByLabelText('Observation window'), {
    target: { value: '72' },
  });
  await screen.findByLabelText('Inspect observation time');
  expect(window.location.search).toContain('windowHours=72');
  const summary = screen.getByRole('region', { name: 'Analysis summary' });
  expect(summary).toHaveTextContent('4');
  expect(summary).toHaveTextContent('48');
  for (let index = 0; index < 2; index++) {
    const box = screen
      .getAllByRole('checkbox')
      .find(
        (input) =>
          !(input as HTMLInputElement).checked &&
          !input.hasAttribute('disabled'),
      )!;
    fireEvent.click(box);
    await screen.findByLabelText('Inspect observation time');
  }
  expect(
    new URLSearchParams(window.location.search).get('compare')!.split(','),
  ).toHaveLength(2);
  expect(
    within(screen.getByLabelText('Series legend')).getAllByRole('listitem'),
  ).toHaveLength(3);
  expect(screen.getByLabelText('Series legend')).toHaveTextContent(
    'Dashed line',
  );
  expect(screen.getByLabelText('Series legend')).toHaveTextContent(
    'Dotted line',
  );
  const link = screen.getByRole('link', { name: 'View Data & Methodology' });
  expect(link.getAttribute('href')).toContain('windowHours=72');
  fireEvent.click(link);
  expect(window.location.pathname).toBe('/data');
});
it('distinguishes zero, negative, null and absent chart slots without interpolation', async () => {
  const h = setup();
  const list = await h.service.stations({});
  const ids = list.data.map((row) => row.id);
  const response = await h.service.analysis({ stationIds: ids.join(',') });
  const rows = chartRows(response.series);
  const alpha = response.series.find(
    (item) =>
      item.station.identity.nativeSiteId === 'SAMPLE-00001' &&
      item.station.identity.monitorId === '00A',
  )!;
  const other = response.series.find(
    (item) => item.station.identity.monitorId === '00B',
  )!;
  expect(
    rows.find((row) => row.time === Date.parse('2026-01-15T17:00:00Z'))![
      alpha.station.id
    ],
  ).toBe(0);
  expect(
    rows.find((row) => row.time === Date.parse('2026-01-15T18:00:00Z'))![
      alpha.station.id
    ],
  ).toBe(-0.2);
  expect(
    rows.find((row) => row.time === Date.parse('2026-01-15T18:00:00Z'))![
      other.station.id
    ],
  ).toBeNull();
  expect(rows.filter((row) => row[alpha.station.id] !== null)).toHaveLength(4);
});
it('keeps unavailable linked primary explicit, permits a deliberate replacement and validates URL bounds', async () => {
  window.history.replaceState(
    {},
    '',
    '/analysis?stationId=s_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&windowHours=168',
  );
  render(<App />);
  expect(
    await screen.findByText(/The linked primary station is not available/),
  ).toBeVisible();
  expect(screen.getByLabelText('Observation window')).toHaveValue('24');
  const select = screen.getByLabelText('Primary monitoring station');
  const option = within(select)
    .getAllByRole('option')
    .find(
      (item) =>
        item.getAttribute('value')?.startsWith('s_') &&
        !item.textContent?.startsWith('Linked'),
    )!;
  fireEvent.change(select, { target: { value: option.getAttribute('value') } });
  await screen.findByLabelText('Inspect observation time');
  expect(
    screen.queryByText(/The linked primary station is not available/),
  ).not.toBeInTheDocument();
  expect(
    parseRoute('?stationId=s_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&compare=bad')
      .compare,
  ).toEqual([]);
  expect(routeSearch(parseRoute('?windowHours=72&mode=sample'))).toContain(
    'windowHours=72',
  );
});
it('rejects stale series responses after a measurement change and displays honest unavailable modes', async () => {
  const result = await setup().service.analysis({});
  let resolveOld: (value: unknown) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ ok: false }),
  );
  render(<App />);
  fireEvent.change(screen.getByLabelText('Measurement type'), {
    target: { value: 'aqi' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sample series unavailable',
  );
  await act(async () => {
    resolveOld({ ok: true, json: async () => result });
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Sample series unavailable',
  );
  expect(
    screen.queryByLabelText('Inspect observation time'),
  ).not.toBeInTheDocument();
  window.history.pushState({}, '', '/analysis?mode=historical');
  fireEvent.popState(window);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'official snapshot',
  );
  const calls = vi.mocked(fetch).mock.calls.length;
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(calls));
});

it('disables incompatible comparison with a reason while allowing it to become the primary unit', async () => {
  const file = { ...structuredClone(fixture), rows: [] as unknown[] };
  file.rows = fixture.rows
    .filter((row) => row.measurement.pollutant === 'O3')
    .map((row) =>
      row.identity.monitorId === '00B' &&
      row.measurement.kind === 'concentration'
        ? {
            ...row,
            measurement: { ...row.measurement, unit: 'ppm' },
            raw: { ...row.raw, unit: 'ppm' },
          }
        : row,
    );
  const h = harness({ sample: new SampleProvider(file) });
  const stations = await h.service.stations({ pollutant: 'O3' });
  const primary = stations.data.find(
    (item) =>
      item.identity.monitorId === '00A' &&
      item.identity.nativeSiteId === 'SAMPLE-00001',
  )!;
  window.history.replaceState(
    {},
    '',
    `/analysis?mode=sample&pollutant=O3&stationId=${primary.id}`,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        h.service.analysis(
          Object.fromEntries(new URL(url, 'http://localhost').searchParams),
        ),
    })),
  );
  render(<App />);
  await screen.findByLabelText('Inspect observation time');
  const incompatible = screen.getByRole('checkbox', {
    name: /^Compare SYNTHETIC SAMPLE Alpha co-located/,
  });
  expect(incompatible).toBeDisabled();
  expect(
    screen.getByText(/Units differ from the primary station/),
  ).toBeVisible();
  const alternate = stations.data.find(
    (item) => item.identity.monitorId === '00B',
  )!;
  fireEvent.change(screen.getByLabelText('Primary monitoring station'), {
    target: { value: alternate.id },
  });
  await screen.findByLabelText('Inspect observation time');
  expect(screen.getByText('Concentration (ppm)')).toBeVisible();
  expect(
    screen.getByRole('region', { name: 'Analysis summary' }),
  ).toHaveTextContent('ppm');
});
