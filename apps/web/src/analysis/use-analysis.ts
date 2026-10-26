import { useEffect, useState } from 'react';
import { analysisSeriesResponseSchema, selectStudyRegion } from '@aq/contracts';
import type { AnalysisSeriesResponse } from '@aq/contracts';
import type { RouteState } from '../route-state.js';
export type AnalysisState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: AnalysisSeriesResponse };
export function useAnalysis(
  route: RouteState,
  enabled: boolean,
): AnalysisState {
  const params = new URLSearchParams({
    region: route.region,
    pollutant: route.pollutant,
    measurementType: route.measurementType,
    mode: route.mode,
    windowHours: String(route.windowHours),
  });
  if (route.snapshotId) params.set('snapshotId', route.snapshotId);
  if (route.station)
    params.set('stationIds', [route.station, ...route.compare].join(','));
  const key = params.toString();
  const [state, setState] = useState<{ key: string; value: AnalysisState }>({
    key: '',
    value: { status: 'loading' },
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    const message =
      route.mode === 'live'
        ? 'Live series unavailable. The AirNow hourly contract is not verified.'
        : route.mode === 'historical'
          ? 'Historical series unavailable. Select an official snapshot with an overlapping observation window.'
          : 'Sample series unavailable. Check the local API connection.';
    const deadline = setTimeout(() => {
      controller.abort();
      if (active) setState({ key, value: { status: 'error', message } });
    }, 12000);
    if (route.mode === 'historical' && !route.snapshotId) {
      clearTimeout(deadline);
      setState({ key, value: { status: 'error', message } });
    } else
      void fetch(`/api/analysis-series?${key}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Unavailable');
          const result = analysisSeriesResponseSchema.parse(
            await response.json(),
          );
          if (
            result.meta.region !== route.region ||
            JSON.stringify(result.meta.bbox) !==
              JSON.stringify(selectStudyRegion(route.region).bbox) ||
            result.meta.pollutant !== route.pollutant ||
            result.meta.measurementType !== route.measurementType ||
            result.meta.dataMode !== route.mode ||
            result.windowHours !== route.windowHours ||
            (route.snapshotId && result.meta.snapshotId !== route.snapshotId) ||
            (route.station && result.primaryId !== route.station) ||
            (route.station &&
              [route.station, ...route.compare].some(
                (id) =>
                  !result.series.some((item) => item.station.id === id) &&
                  !result.missingStationIds.includes(id),
              )) ||
            result.missingStationIds.some(
              (id) =>
                route.station &&
                ![route.station, ...route.compare].includes(id),
            ) ||
            result.series.some(
              (item) =>
                route.station &&
                ![route.station, ...route.compare].includes(item.station.id),
            )
          )
            throw new Error('Unexpected context');
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
  }, [
    enabled,
    key,
    route.region,
    route.pollutant,
    route.measurementType,
    route.mode,
    route.windowHours,
    route.snapshotId,
    route.station,
  ]);
  return state.key === key ? state.value : { status: 'loading' };
}
