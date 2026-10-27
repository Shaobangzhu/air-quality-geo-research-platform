import {
  analysisWindowSchema,
  dataProductIdSchema,
  areaIdSchema,
  dataModeSchema,
  measurementTypeSchema,
  pollutantSchema,
  regionIdSchema,
  stationIdSchema,
} from '@aq/contracts';
import { z } from 'zod';

export const pages = [
  {
    path: '/map',
    name: 'Map Explorer',
    icon: 'map',
    description:
      'Monitoring sites and geographic context across Greater Los Angeles.',
  },
  {
    path: '/analysis',
    name: 'Analysis',
    icon: 'chart',
    description:
      'Pollutant exploration and time series with explicit measurement semantics.',
  },
  {
    path: '/wildfire',
    name: 'Wildfire Case Study',
    icon: 'fire',
    description:
      'Historical fire context with carefully bounded research questions.',
  },
  {
    path: '/data',
    name: 'Data & Methodology',
    icon: 'layers',
    description:
      'Sources, provenance, validation status and scientific limitations.',
  },
] as const;
export function parseRoute(search: string) {
  const params = new URLSearchParams(search);
  const one = (name: string) =>
    params.getAll(name).length === 1 ? params.get(name) : undefined;
  const mode = dataModeSchema.safeParse(one('mode')).data ?? 'sample';
  const product =
    dataProductIdSchema.safeParse(one('product')).data ?? 'monitoring-stations';
  const station =
    product === 'monitoring-stations'
      ? stationIdSchema.safeParse(
          params.has('stationId') ? one('stationId') : one('station'),
        ).data
      : undefined;
  const compare =
    z.array(stationIdSchema).max(2).safeParse(one('compare')?.split(','))
      .data ?? [];
  return {
    caseId: one('case') === 'eaton-fire-2025' ? 'eaton-fire-2025' : undefined,
    windowHours:
      analysisWindowSchema.safeParse(Number(one('windowHours'))).data ?? 24,
    compare: station
      ? [...new Set(compare)].filter((id) => id !== station).sort()
      : [],
    region: regionIdSchema.safeParse(one('region')).data ?? 'greater-la',
    pollutant: pollutantSchema.safeParse(one('pollutant')).data ?? 'PM2.5',
    product,
    area:
      product !== 'monitoring-stations'
        ? areaIdSchema.safeParse(one('areaId')).data
        : undefined,
    mode,
    measurementType:
      product === 'monitoring-stations'
        ? (measurementTypeSchema.safeParse(one('measurementType')).data ??
          'concentration')
        : ('aqi' as const),
    station,
    snapshotId:
      mode === 'historical' && product === 'monitoring-stations'
        ? z.uuid().safeParse(one('snapshotId')).data
        : undefined,
  };
}
export type RouteState = ReturnType<typeof parseRoute>;
export type RoutePatch = Partial<
  Omit<RouteState, 'station' | 'snapshotId' | 'area'>
> & {
  station?: string | undefined;
  area?: string | undefined;
  snapshotId?: string | undefined;
};
export function routeSearch(state: RouteState) {
  const params = new URLSearchParams({
    region: state.region,
    pollutant: state.pollutant,
    product: state.product,
    mode: state.mode,
    measurementType: state.measurementType,
  });
  if (state.caseId) params.set('case', state.caseId);
  if (state.station && state.product === 'monitoring-stations')
    params.set('stationId', state.station);
  if (state.area && state.product !== 'monitoring-stations')
    params.set('areaId', state.area);
  if (state.windowHours !== 24)
    params.set('windowHours', String(state.windowHours));
  if (state.station && state.compare.length)
    params.set('compare', state.compare.join(','));
  if (
    state.snapshotId &&
    state.mode === 'historical' &&
    state.product === 'monitoring-stations'
  )
    params.set('snapshotId', state.snapshotId);
  return `?${params}`;
}

export const modeNames = {
  sample: 'Sample',
  historical: 'Historical',
  live: 'Live',
} as const;

export function analysisHref(state: RouteState, stationId: string) {
  return `/analysis${routeSearch({ ...state, product: 'monitoring-stations', area: undefined, compare: [], station: stationIdSchema.parse(stationId) })}`;
}
export const modeDescriptions = {
  sample: 'Synthetic sample',
  historical: 'Stored historical snapshot',
  live: 'Verified live observations',
} as const;

export function routeForPage(state: RouteState, path: string): RouteState {
  if (path === '/wildfire')
    return {
      ...state,
      caseId: 'eaton-fire-2025',
      product: 'monitoring-stations',
      station: undefined,
      area: undefined,
      snapshotId: undefined,
      compare: [],
    };
  if (path === '/map' || path === '/analysis')
    state = { ...state, caseId: undefined };
  return path === '/analysis' && state.product !== 'monitoring-stations'
    ? {
        ...state,
        product: 'monitoring-stations',
        area: undefined,
        station: undefined,
        compare: [],
      }
    : state;
}
