import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GREATER_LA } from '@aq/contracts';
const sdk = vi.hoisted(() => ({
  update: vi.fn(),
  destroy: vi.fn(),
  status: undefined as undefined | ((value: 'ready' | 'unavailable') => void),
}));
const mountMap = vi.fn((_host, _key, _bounds, _visible, status) => {
  sdk.status = status;
  return { update: sdk.update, destroy: sdk.destroy };
});
const loadRuntime = async () => ({ mountMap });
import { MapCanvas } from './MapCanvas.js';
beforeEach(() => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', 'PUBLIC_TEST_TOKEN');
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('mounts once through StrictMode, updates extent and visibility, and disposes once', async () => {
  const status = vi.fn();
  const { rerender, unmount } = render(
    <StrictMode>
      <MapCanvas
        loadRuntime={loadRuntime}
        boundaryVisible
        onAvailability={status}
      />
    </StrictMode>,
  );
  await waitFor(() => expect(mountMap).toHaveBeenCalledOnce());
  rerender(
    <StrictMode>
      <MapCanvas
        loadRuntime={loadRuntime}
        bounds={{ ...GREATER_LA.bbox, west: -118.9 }}
        boundaryVisible={false}
        onAvailability={status}
      />
    </StrictMode>,
  );
  expect(sdk.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ west: -118.9 }),
    false,
  );
  expect(mountMap).toHaveBeenCalledOnce();
  unmount();
  expect(sdk.destroy).toHaveBeenCalledOnce();
});
it('blocks SDK initialization without a public credential', () => {
  vi.stubEnv('VITE_ARCGIS_API_KEY', '');
  render(
    <MapCanvas
      loadRuntime={loadRuntime}
      boundaryVisible
      onAvailability={vi.fn()}
    />,
  );
  expect(screen.getByText('Basemap unavailable')).toBeVisible();
  expect(mountMap).not.toHaveBeenCalled();
});
it('bounds initialization time, destroys a stalled map, and shows a safe message', async () => {
  vi.useFakeTimers();
  render(
    <MapCanvas
      loadRuntime={loadRuntime}
      boundaryVisible
      onAvailability={vi.fn()}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(screen.getByText('Basemap unavailable')).toBeVisible();
  expect(screen.queryByText('PUBLIC_TEST_TOKEN')).not.toBeInTheDocument();
  expect(sdk.destroy).toHaveBeenCalledOnce();
});
it('reports successful loading and later tile failure without recreating the view', async () => {
  const status = vi.fn();
  render(
    <MapCanvas
      loadRuntime={loadRuntime}
      boundaryVisible
      onAvailability={status}
    />,
  );
  await waitFor(() => expect(mountMap).toHaveBeenCalledOnce());
  // Use an event to execute the callback inside React Testing Library act.
  const host = screen.getByLabelText('Map canvas');
  host.addEventListener('test-ready', () => sdk.status?.('ready'));
  fireEvent(host, new Event('test-ready'));
  expect(status).toHaveBeenLastCalledWith(true);
  expect(
    screen.queryByText('Loading geographic context…'),
  ).not.toBeInTheDocument();
  host.addEventListener('test-fail', () => sdk.status?.('unavailable'));
  fireEvent(host, new Event('test-fail'));
  expect(screen.getByText('Basemap unavailable')).toBeVisible();
  expect(mountMap).toHaveBeenCalledOnce();
  expect(sdk.destroy).toHaveBeenCalledOnce();
});
