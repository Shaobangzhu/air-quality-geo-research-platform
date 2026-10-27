import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { loadWildfireCase } from '../../../api/src/wildfire/case.js';
import { Wildfire } from './Wildfire.js';
const data = {
  status: 'ready' as const,
  result: loadWildfireCase(
    pathToFileURL(resolve('fixtures/historical/eaton-fire-2025') + '/'),
  ),
};
afterEach(() => vi.unstubAllEnvs());
it('keeps official source timing visible with accessible non-map inspection and missing records', () => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  render(
    <Wildfire
      data={data}
      mode="historical"
      openHistorical={() => {}}
      navigate={() => {}}
    />,
  );
  expect(screen.getByText('Basemap unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: '3D unavailable' })).toBeDisabled();
  expect(
    screen.getByLabelText('Official AirNow contours — unverified'),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Context selection'), {
    target: { value: data.result.layers.find((f) => f.layer === 'lra')!.id },
  });
  expect(
    screen.getByText('Published after ignition; not an as-of-Jan-7 layer.'),
  ).toBeVisible();
  expect(screen.getByText('Not established here')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Later checkpoint/ }));
  fireEvent.change(screen.getByLabelText('Observation hour (PST)'), {
    target: { value: '05' },
  });
  expect(screen.getByText('Selected monitor')).toBeVisible();
  expect(screen.getByText('Missing observation')).toBeVisible();
  expect(screen.getByText(/row certification unknown/)).toBeVisible();
  expect(screen.queryByText('Analyze This Station')).not.toBeInTheDocument();
});
it('never shows historical observations as sample or live after an unavailable response', () => {
  render(
    <Wildfire
      data={{ status: 'error' }}
      mode="live"
      openHistorical={() => {}}
      navigate={() => {}}
    />,
  );
  expect(screen.getByText('Historical case only')).toBeVisible();
  expect(screen.queryByLabelText('Context selection')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open historical Eaton case' }),
  ).toBeEnabled();
});
