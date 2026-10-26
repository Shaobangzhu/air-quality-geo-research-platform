import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import { areaHarness } from '../../../../tests/helpers/areas.js';
import { parseRoute, routeForPage, routeSearch } from '../route-state.js';
const calls: string[] = [];
beforeEach(() => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  calls.length = 0;
  const h = areaHarness();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const query = Object.fromEntries(
        new URL(url, 'http://localhost').searchParams,
      );
      try {
        return {
          ok: true,
          json: async () =>
            url.startsWith('/api/forecasts')
              ? h.areas.read('forecast', query)
              : url.startsWith('/api/reporting-area-aqi')
                ? h.areas.read('reporting-area-aqi', query)
                : url.startsWith('/api/analysis-series')
                  ? h.station.service.analysis(query)
                  : h.station.service.stationReadings(query),
        };
      } catch {
        return { ok: false };
      }
    }),
  );
  window.history.replaceState({}, '', '/map?mode=sample');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});
it('switches to distinct sample aggregates, suppresses station controls, and restores focus after inspecting area metadata', async () => {
  render(<App />);
  await screen.findAllByRole('button', { name: /^Inspect SYNTHETIC SAMPLE/ });
  fireEvent.change(screen.getByLabelText('Data Product'), {
    target: { value: 'reporting-area-aqi' },
  });
  const options = await screen.findAllByRole('button', {
    name: /^Inspect reporting area/,
  });
  expect(options).toHaveLength(2);
  expect(
    screen.queryByLabelText('Monitoring station readings'),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Map metric')).toBeDisabled();
  expect(screen.getByLabelText('Reporting Area AQI legend')).toHaveTextContent(
    'not the AQI of a specific',
  );
  expect(
    screen.queryByRole('button', { name: /^Inspect SYNTHETIC SAMPLE/ }),
  ).not.toBeInTheDocument();
  const before = calls.length;
  fireEvent.click(options[0]!);
  const drawer = screen.getByRole('complementary', {
    name: 'Reporting Area Details',
  });
  expect(drawer).toHaveTextContent(
    'Reporting-area aggregate; not a station reading',
  );
  expect(drawer).not.toHaveTextContent('Concentration');
  expect(
    screen.queryByRole('link', { name: 'Analyze This Station' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Close reporting area details' }),
  ).toHaveFocus();
  fireEvent.keyDown(drawer, { key: 'Escape' });
  expect(options[0]).toHaveFocus();
  expect(calls).toHaveLength(before);
  fireEvent.change(screen.getByLabelText('Data Product'), {
    target: { value: 'monitoring-stations' },
  });
  expect(
    await screen.findAllByRole('button', { name: /^Inspect SYNTHETIC SAMPLE/ }),
  ).toHaveLength(3);
});
it('renders category-only date forecasts and unknown issuance without creating observation timestamps', async () => {
  window.history.replaceState({}, '', '/map?product=forecast&mode=sample');
  render(<App />);
  const options = await screen.findAllByRole('button', {
    name: /^Inspect reporting area/,
  });
  fireEvent.click(options[0]!);
  const drawer = screen.getByRole('complementary', {
    name: 'Reporting Area Details',
  });
  expect(drawer).toHaveTextContent('AQI number not supplied · category only');
  expect(drawer).toHaveTextContent('Not supplied; issuance time unknown');
  expect(drawer).toHaveTextContent('2026-01-16 · date only');
  expect(drawer).toHaveTextContent('no hourly UTC interval inferred');
  expect(drawer).toHaveTextContent('Prediction · not an observation');
  expect(
    within(drawer).queryByText('Observation time'),
  ).not.toBeInTheDocument();
  const link = within(drawer).getByRole('link', {
    name: 'View Data & Methodology',
  });
  expect(link.getAttribute('href')).toContain('product=forecast');
  expect(link.getAttribute('href')).toContain('areaId=ra_');
  const count = calls.length;
  fireEvent.click(link);
  expect(window.location.pathname).toBe('/data');
  expect(calls).toHaveLength(count);
});
it('disables official modes, keeps explicit unavailable state, and never falls back to station samples', async () => {
  window.history.replaceState({}, '', '/map?product=forecast&mode=live');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'contract is not verified',
  );
  expect(
    screen.getByRole('option', { name: 'Forecast · unavailable' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('option', { name: 'Reporting Area AQI · unavailable' }),
  ).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: /^Inspect/ }),
  ).not.toBeInTheDocument();
  expect(calls.every((url) => url.startsWith('/api/forecasts'))).toBe(true);
  fireEvent.change(screen.getByLabelText('Data mode'), {
    target: { value: 'historical' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'no verified reporting-area archive',
  );
});
it('rejects stale or wrong-product responses and preserves honest empty pollutant/preset results', async () => {
  const h = areaHarness();
  const current = await h.areas.read('reporting-area-aqi', {});
  let oldResolve: (value: unknown) => void = () => {};
  window.history.replaceState(
    {},
    '',
    '/map?product=reporting-area-aqi&mode=sample',
  );
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResolve = resolve;
          }),
      )
      .mockResolvedValue({ ok: true, json: async () => current }),
  );
  render(<App />);
  fireEvent.change(screen.getByLabelText('Data Product'), {
    target: { value: 'forecast' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic reporting-area product unavailable',
  );
  await act(async () => oldResolve({ ok: true, json: async () => current }));
  expect(
    screen.queryByRole('button', { name: /^Inspect reporting area/ }),
  ).not.toBeInTheDocument();
});
it('deep-links area identities separately and strips area products from Analysis context', async () => {
  const h = areaHarness();
  const current = await h.areas.read('reporting-area-aqi', {});
  const area = current.data[0]!.area.id;
  window.history.replaceState(
    {},
    '',
    `/map?product=reporting-area-aqi&areaId=${area}&stationId=s_${'a'.repeat(32)}&measurementType=concentration`,
  );
  render(<App />);
  expect(
    await screen.findByRole('complementary', {
      name: 'Reporting Area Details',
    }),
  ).toHaveTextContent('SAMPLE-AREA-001');
  const route = parseRoute(window.location.search);
  expect(route.station).toBeUndefined();
  expect(route.measurementType).toBe('aqi');
  expect(routeSearch(route)).not.toContain('stationId');
  const analysis = routeForPage(route, '/analysis');
  expect(analysis.product).toBe('monitoring-stations');
  expect(analysis.area).toBeUndefined();
  expect(
    parseRoute(
      '?product=forecast&mode=historical&snapshotId=00000000-0000-4000-8000-000000000002',
    ).snapshotId,
  ).toBeUndefined();
  fireEvent.click(
    within(screen.getByRole('navigation')).getByRole('link', {
      name: 'Analysis',
    }),
  );
  await screen.findByRole('heading', { name: 'Observation Trends' });
  expect(window.location.search).toContain('product=monitoring-stations');
  expect(window.location.search).not.toContain('areaId');
  await waitFor(() =>
    expect(calls.some((url) => url.startsWith('/api/analysis-series'))).toBe(
      true,
    ),
  );
});

it('shows empty preset results without inventing region membership or restoring station samples', async () => {
  window.history.replaceState(
    {},
    '',
    '/map?product=reporting-area-aqi&mode=sample',
  );
  render(<App />);
  await screen.findAllByRole('button', { name: /^Inspect reporting area/ });
  fireEvent.change(screen.getByLabelText('Region'), {
    target: { value: 'coastal-la' },
  });
  expect(
    await screen.findByText(/No PM2.5 reporting-area AQI records are supplied/),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^Inspect/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Reporting Area AQI legend')).toHaveTextContent(
    'No area symbols',
  );
});
