import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataWorkbench as Service } from '../../../api/src/data/workbench.js';
import { loadWildfireCase } from '../../../api/src/wildfire/case.js';
import { areaHarness } from '../../../../tests/helpers/areas.js';
import { App } from '../App.js';
let calls: string[] = [];
beforeEach(() => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  calls = [];
  const h = areaHarness();
  const service = new Service(h.station.service, h.areas, () =>
    loadWildfireCase(
      pathToFileURL(resolve('fixtures/historical/eaton-fire-2025') + '/'),
    ),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const q = Object.fromEntries(
        new URL(url, 'http://localhost').searchParams,
      );
      try {
        return {
          ok: true,
          json: async () =>
            url.startsWith('/api/data/catalog')
              ? await service.catalog()
              : url.startsWith('/api/data/preview')
                ? await service.preview(q)
                : h.station.service.usage(),
        };
      } catch {
        return { ok: false };
      }
    }),
  );
  window.history.replaceState({}, '', '/data?mode=sample');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});
it('shows exactly four internal tabs, compact truthful source details, methods and real zero provider counters', async () => {
  render(<App />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  await screen.findByRole('button', { name: /View source Eaton study · EPA/ });
  fireEvent.click(
    screen.getByRole('button', { name: /View source Eaton study · EPA/ }),
  );
  const detail = screen.getByRole('complementary', { name: 'Source details' });
  expect(detail).toHaveTextContent('row certification unknown');
  fireEvent.click(screen.getByRole('tab', { name: 'Scientific Methodology' }));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByText('AQI vs Concentration')).toBeVisible();
  expect(screen.getByText('Fire Hazard Severity Zones (FHSZ)')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: 'API Usage' }));
  await screen.findByText('Since Server Start');
  await screen.findByText(/lastUpdatedAt/);
  expect(screen.getByText('Outbound attempts').parentElement).toHaveTextContent(
    '0',
  );
  expect(screen.getByText('ArcGIS (client)')).toBeVisible();
  expect(calls).toEqual(['/api/data/catalog', '/api/usage/summary']);
  expect(screen.queryByRole('img', { name: /chart/i })).not.toBeInTheDocument();
});
it('invalidates exports on filter changes and preserves selected native identities while preview reloads', async () => {
  render(<App />);
  await screen.findByRole('button', { name: /View source Eaton study · EPA/ });
  fireEvent.click(screen.getByRole('tab', { name: 'Data Preview & Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load preview' }));
  await screen.findByRole('button', { name: 'Export JSON' });
  const select = screen.getByLabelText('Station / monitor');
  await waitFor(() =>
    expect(within(select).getAllByRole('option').length).toBeGreaterThan(1),
  );
  const option = within(select).getAllByRole('option')[1]!;
  fireEvent.change(select, { target: { value: option.getAttribute('value') } });
  expect(
    screen.queryByRole('button', { name: 'Export JSON' }),
  ).not.toBeInTheDocument();
  expect(select).toHaveValue(option.getAttribute('value'));
  fireEvent.click(screen.getByRole('button', { name: 'Load preview' }));
  await screen.findByRole('button', { name: 'Export CSV' });
  expect(calls.at(-1)).toContain('stationId=s_');
  fireEvent.change(screen.getByLabelText('Measurement'), {
    target: { value: 'aqi' },
  });
  expect(
    screen.queryByRole('button', { name: 'Export JSON' }),
  ).not.toBeInTheDocument();
});
it('keeps forecast date-only semantics and displays an unavailable API without decorative metrics', async () => {
  window.history.replaceState(
    {},
    '',
    '/data?mode=sample&product=forecast&tab=preview',
  );
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Load preview' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load preview' }));
  await screen.findByText('2026-01-16 · date only');
  expect(screen.getByText('Issued: unknown')).toBeVisible();
  expect(screen.getByText('Number not supplied')).toBeVisible();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  fireEvent.click(screen.getByRole('tab', { name: 'API Usage' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No estimated values',
  );
  expect(screen.queryByText('Outbound attempts')).not.toBeInTheDocument();
});
it('supports tab arrow navigation and isolates explicit historical context from synthetic defaults', async () => {
  window.history.replaceState({}, '', '/data?mode=historical');
  render(<App />);
  await screen.findByRole('button', { name: /View source Eaton study · EPA/ });
  const sources = screen.getByRole('tab', { name: 'Data Sources' });
  sources.focus();
  fireEvent.keyDown(sources, { key: 'ArrowRight' });
  expect(
    screen.getByRole('tab', { name: 'Data Preview & Export' }),
  ).toHaveFocus();
  expect(screen.getByLabelText('Dataset')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Load preview' })).toBeDisabled();
  expect(window.location.search).toContain('tab=preview');
  expect(calls).toEqual(['/api/data/catalog']);
});
