import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});
it('renders identity, all four planned pages and honest sample availability', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        service: 'aq-research-api',
        status: 'ok',
        database: 'not-configured',
        data: {
          mode: 'sample',
          state: 'unavailable',
          reason: 'foundation-only',
        },
      }),
    }),
  );
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Greater LA Air Quality Geo Research Platform',
  );
  expect(
    screen.getByText(
      'Interdisciplinary Research & Software Engineering Workbench — v1',
    ),
  ).toBeInTheDocument();
  for (const name of [
    'Map Explorer',
    'Analysis',
    'Wildfire Case Study',
    'Data & Methodology',
  ])
    expect(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: new RegExp(name),
      }),
    ).toBeInTheDocument();
  expect(
    await screen.findByText('Configured mode: sample'),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Air-quality data unavailable',
  );
  expect(screen.getByText(/Not for regulatory decisions/)).toBeInTheDocument();
});
it('does not fabricate a data mode when health is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(<App />);
  expect(await screen.findByText('Local API unavailable')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Data mode could not be verified',
  );
  expect(screen.queryByText('Configured mode: sample')).not.toBeInTheDocument();
});
it('rejects malformed health and opens the requested route shell', async () => {
  window.history.replaceState({}, '', '/wildfire');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }),
  );
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'Wildfire Case Study' }),
  ).toBeInTheDocument();
  expect(await screen.findByText('Local API unavailable')).toBeInTheDocument();
});
