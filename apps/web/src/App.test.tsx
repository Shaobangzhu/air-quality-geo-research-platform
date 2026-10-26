import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { harness } from '../../../tests/helpers/bff.js';
import fixture from '../../../fixtures/synthetic/bff-hourly.json';
import { SampleProvider } from '../../api/src/bff/providers.js';
const webHarness = () => harness({ sample: new SampleProvider(fixture) });
import { App } from './App.js';
import { parseRoute, routeSearch } from './route-state.js';

beforeEach(() => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  const h = webHarness();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const query = Object.fromEntries(
        new URL(url, 'http://localhost').searchParams,
      );
      try {
        return {
          ok: true,
          json: async () => await h.service.stationReadings(query),
        };
      } catch {
        return { ok: false };
      }
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});
it('renders exactly four navigation routes, active map, sample availability and honest unavailable map', async () => {
  render(<App />);
  expect(
    screen.getByText('Greater LA Air Quality Geo Research Platform'),
  ).toBeVisible();
  expect(
    screen.getByText(
      'Interdisciplinary Research & Software Engineering Workbench — v1',
    ),
  ).toBeVisible();
  const nav = screen.getByRole('navigation');
  expect(within(nav).getAllByRole('link')).toHaveLength(4);
  expect(
    within(nav).getByRole('link', { name: 'Map Explorer' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(await screen.findByText('Sample · Synthetic')).toBeVisible();
  expect(screen.getByText('Basemap unavailable')).toBeVisible();
  expect(screen.getByLabelText('Region')).toBeDisabled();
  expect(screen.getByLabelText('Data Product')).toBeDisabled();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByText('AQI 78')).not.toBeInTheDocument();
});
it('opens only a selected identity, retains co-located monitors, and returns keyboard focus on Escape', async () => {
  render(<App />);
  const options = await screen.findAllByRole('button', { name: /^Inspect/ });
  expect(options).toHaveLength(3);
  fireEvent.click(options[0]!);
  const drawer = screen.getByRole('complementary', { name: 'Station Details' });
  expect(drawer).toHaveTextContent('Fictional Research Test Agency');
  expect(
    screen.getByRole('button', { name: 'Close station details' }),
  ).toHaveFocus();
  expect(new URLSearchParams(window.location.search).get('stationId')).toMatch(
    /^s_/,
  );
  fireEvent.keyDown(drawer, { key: 'Escape' });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(options[0]).toHaveFocus();
});
it('collapses legend with semantic expanded state and disables unsupported layer controls', async () => {
  render(<App />);
  const legend = screen.getByRole('button', { name: 'Layers & Legend' });
  expect(legend).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByLabelText('Monitoring station readings')).toBeDisabled();
  expect(screen.getByLabelText('Study extent')).toBeDisabled();
  fireEvent.click(legend);
  expect(legend).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByLabelText('Study extent')).not.toBeInTheDocument();
  await screen.findByText('Sample · Synthetic');
});
it('validates URL defaults, strips unsupported or duplicate fields and preserves allowed selections in links', async () => {
  window.history.replaceState(
    {},
    '',
    '/map?pollutant=O3&mode=sample&region=world&key=secret',
  );
  render(<App />);
  await screen.findByText('Sample · Synthetic');
  expect(screen.getByLabelText('Pollutant')).toHaveValue('O3');
  const nav = screen.getByRole('navigation');
  fireEvent.click(within(nav).getByRole('link', { name: 'Analysis' }));
  expect(
    screen.getByRole('heading', { level: 1, name: 'Analysis' }),
  ).toBeVisible();
  expect(window.location.search).toContain('pollutant=O3');
  expect(window.location.search).not.toContain('secret');
  expect(screen.getByRole('main')).toHaveFocus();
  expect(within(nav).getByRole('link', { name: 'Analysis' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByText('This workspace is planned')).toBeVisible();
  expect(
    parseRoute('?mode=invalid&pollutant=O3&pollutant=PM10&station=bad')
      .pollutant,
  ).toBe('PM2.5');
  expect(parseRoute('?mode=invalid').mode).toBe('sample');
  expect(
    routeSearch(
      parseRoute('?mode=live&snapshotId=00000000-0000-4000-8000-000000000002'),
    ),
  ).not.toContain('snapshotId');
});
it('handles popstate and changes pollutant using one bounded BFF request per context', async () => {
  render(<App />);
  await screen.findByText('Sample · Synthetic');
  fireEvent.change(screen.getByLabelText('Pollutant'), {
    target: { value: 'PM10' },
  });
  await waitFor(() =>
    expect(screen.getByLabelText('Pollutant')).toHaveValue('PM10'),
  );
  await screen.findByText('Sample · Synthetic');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain(
    'pollutant=PM10',
  );
  window.history.pushState({}, '', '/data?pollutant=O3&mode=sample');
  fireEvent.popState(window);
  expect(
    screen.getByRole('heading', { name: 'Data & Methodology' }),
  ).toBeVisible();
  await screen.findByText('Sample · Synthetic');
});
it('shows unavailable live and missing historical snapshot without fallback', async () => {
  window.history.replaceState({}, '', '/map?mode=live');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Live observations unavailable',
  );
  expect(screen.getByLabelText('Data status')).toHaveTextContent('Unavailable');
  expect(screen.queryByText('Sample · Synthetic')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Data mode'), {
    target: { value: 'historical' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'official curated snapshot',
  );
  expect(fetch).toHaveBeenCalledOnce();
});
it('rejects malformed and mismatched responses without rendering provider errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ secret: 'DO_NOT_DISPLAY' }),
    }),
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sample observations unavailable',
  );
  expect(screen.queryByText(/DO_NOT_DISPLAY/)).not.toBeInTheDocument();
});
it('renders a valid empty selection and rejects an absent linked station', async () => {
  const result = await webHarness().service.stationReadings({ mode: 'sample' });
  result.data = [];
  result.meta.resultState = 'empty';
  result.meta.pagination.total = 0;
  window.history.replaceState({}, '', `/map?station=s_${'a'.repeat(32)}`);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => result }),
  );
  render(<App />);
  expect(
    await screen.findByText('No monitor readings match this selection.'),
  ).toBeVisible();
  expect(
    screen.getByText('The linked station is not present in this selection.'),
  ).toBeVisible();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
it('restores a validated sample station deep link and prevents stale data while a new context loads', async () => {
  const result = await webHarness().service.stationReadings({ mode: 'sample' });
  window.history.replaceState(
    {},
    '',
    `/map?station=${result.data[0]!.station.id}`,
  );
  render(<App />);
  expect(await screen.findByRole('complementary')).toBeVisible();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  fireEvent.change(screen.getByLabelText('Pollutant'), {
    target: { value: 'O3' },
  });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByText('Sample · Synthetic')).not.toBeInTheDocument();
  expect(screen.getByText('Loading station readings…')).toBeVisible();
});

it('shows independent readings, source statuses/times and an actionable validated Analyze link without another fetch', async () => {
  const { rerender } = render(<App />);
  const options = await screen.findAllByRole('button', { name: /^Inspect/ });
  const initialRequests = vi.mocked(fetch).mock.calls.length;
  fireEvent.click(options[0]!);
  const drawer = screen.getByRole('complementary');
  expect(drawer).toHaveTextContent('Synthetic sample');
  expect(
    within(drawer).getByRole('region', { name: 'AQI observation' }),
  ).toBeVisible();
  expect(
    within(drawer).getByRole('region', { name: 'Concentration observation' }),
  ).toBeVisible();
  expect(drawer).toHaveTextContent('unknown');
  expect(drawer).toHaveTextContent('PST');
  expect(drawer).toHaveTextContent('2026-01-15T20:00:00Z');
  const link = within(drawer).getByRole('link', {
    name: 'Analyze This Station',
  });
  expect(link).toHaveAttribute('href', expect.stringContaining('/analysis?'));
  expect(link).toHaveAttribute('href', expect.stringContaining('stationId=s_'));
  rerender(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layers & Legend' }));
  expect(fetch).toHaveBeenCalledTimes(initialRequests);
  fireEvent.click(link);
  expect(window.location.pathname).toBe('/analysis');
  expect(window.location.search).toContain('stationId=s_');
  expect(screen.getByText(/Selected monitor:/)).toHaveTextContent(
    'SYNTHETIC SAMPLE',
  );
  expect(fetch).toHaveBeenCalledTimes(initialRequests);
});
it('updates the metric and synchronized legend without leaking concentration bins into AQI', async () => {
  render(<App />);
  await screen.findByText('Sample · Synthetic');
  expect(screen.getByLabelText('Concentration legend')).toHaveTextContent(
    'µg/m³',
  );
  fireEvent.change(screen.getByLabelText('Map metric'), {
    target: { value: 'aqi' },
  });
  await screen.findByText('Sample · Synthetic');
  expect(screen.getByLabelText('AQI legend')).toHaveTextContent(
    '51–100 · Moderate',
  );
  expect(
    screen.queryByLabelText('Concentration legend'),
  ).not.toBeInTheDocument();
  expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain(
    'measurementType=aqi',
  );
  expect(parseRoute('?measurementType=invalid').measurementType).toBe(
    'concentration',
  );
});
it('does not render mismatched context and labels a valid stale response explicitly', async () => {
  const result = await webHarness().service.stationReadings({ mode: 'sample' });
  result.meta.cache.status = 'stale';
  result.meta.cache.staleReason = 'UPSTREAM_NETWORK';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => result }),
  );
  render(<App />);
  expect(
    await screen.findByText(
      'Stale cached observations. The source could not be refreshed.',
    ),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText('Pollutant'), {
    target: { value: 'O3' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sample observations unavailable',
  );
  expect(
    screen.queryByRole('button', { name: /^Inspect/ }),
  ).not.toBeInTheDocument();
});
