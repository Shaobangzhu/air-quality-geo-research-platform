import { useEffect, useState } from 'react';
import { stationsResponseSchema } from '@aq/contracts';
import type { z } from 'zod';
import type { RouteState } from './route-state.js';
export type StationResult = z.infer<typeof stationsResponseSchema>;
export type DataState =
  | { status: 'loading' }
  | { status: 'ready'; result: StationResult }
  | { status: 'error'; message: string };
export function useStations(route: RouteState): DataState {
  const query = new URLSearchParams({
    region: route.region,
    pollutant: route.pollutant,
    measurementType: 'concentration',
    mode: route.mode,
  });
  if (route.snapshotId) query.set('snapshotId', route.snapshotId);
  const key = query.toString();
  const [state, setState] = useState<{ key: string; value: DataState }>({
    key: '',
    value: { status: 'loading' },
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const deadline = setTimeout(() => controller.abort(), 12000);
    const errorMessage =
      route.mode === 'live'
        ? 'Live observations unavailable. The AirNow provider contract is not verified.'
        : route.mode === 'historical'
          ? 'Historical observations unavailable. An official curated snapshot is required.'
          : 'Sample observations unavailable. Check the local API connection.';
    if (route.mode === 'historical' && !route.snapshotId) {
      setState({ key, value: { status: 'error', message: errorMessage } });
    } else {
      void fetch(`/api/stations?${key}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Unavailable');
          const result = stationsResponseSchema.parse(await response.json());
          if (
            result.meta.dataMode !== route.mode ||
            result.meta.pollutant !== route.pollutant ||
            result.meta.measurementType !== 'concentration'
          )
            throw new Error('Unexpected context');
          return result;
        })
        .then((result) => {
          if (active) setState({ key, value: { status: 'ready', result } });
        })
        .catch(() => {
          if (active)
            setState({
              key,
              value: { status: 'error', message: errorMessage },
            });
        })
        .finally(() => clearTimeout(deadline));
    }
    return () => {
      active = false;
      controller.abort();
      clearTimeout(deadline);
    };
  }, [key, route.mode, route.pollutant, route.snapshotId]);
  return state.key === key ? state.value : { status: 'loading' };
}
