import { useEffect, useState } from 'react';
import { areaProductsResponseSchema } from '@aq/contracts';
import type { AreaProductsResponse } from '@aq/contracts';
import type { RouteState } from './route-state.js';
export type AreaDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: AreaProductsResponse };
export function useAreaProducts(
  route: RouteState,
  enabled: boolean,
): AreaDataState {
  const query = new URLSearchParams({
    region: route.region,
    pollutant: route.pollutant,
    mode: route.mode,
  });
  const key = `${route.product}?${query}`;
  const [state, setState] = useState<{ key: string; value: AreaDataState }>({
    key: '',
    value: { status: 'loading' },
  });
  useEffect(() => {
    if (!enabled || route.product === 'monitoring-stations') return;
    const controller = new AbortController();
    let active = true;
    const message =
      route.mode === 'live'
        ? 'This live product is unavailable: the AirNow request/response contract is not verified.'
        : route.mode === 'historical'
          ? 'This historical product is unavailable: no verified reporting-area archive is configured.'
          : 'Synthetic reporting-area product unavailable. Check the local API connection.';
    const deadline = setTimeout(() => {
      controller.abort();
      if (active) setState({ key, value: { status: 'error', message } });
    }, 12000);
    void fetch(
      `/api/${route.product === 'forecast' ? 'forecasts' : 'reporting-area-aqi'}?${query}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const result = areaProductsResponseSchema.parse(await response.json());
        if (
          result.meta.product !== route.product ||
          result.meta.dataMode !== route.mode ||
          result.meta.pollutant !== route.pollutant ||
          result.meta.region !== route.region
        )
          throw new Error('Unexpected product');
        if (active && !controller.signal.aborted)
          setState({ key, value: { status: 'ready', result } });
      })
      .catch(() => {
        if (active) setState({ key, value: { status: 'error', message } });
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(deadline);
    };
  }, [enabled, key, route.product, route.region, route.pollutant, route.mode]);
  return state.key === key ? state.value : { status: 'loading' };
}
