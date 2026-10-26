import {
  dataModeSchema,
  pollutantSchema,
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
  return {
    region: 'greater-la' as const,
    pollutant: pollutantSchema.safeParse(one('pollutant')).data ?? 'PM2.5',
    product: 'monitoring-stations' as const,
    mode,
    station: stationIdSchema.safeParse(one('station')).data,
    snapshotId:
      mode === 'historical'
        ? z.uuid().safeParse(one('snapshotId')).data
        : undefined,
  };
}
export type RouteState = ReturnType<typeof parseRoute>;
export type RoutePatch = Partial<Omit<RouteState, 'station' | 'snapshotId'>> & {
  station?: string | undefined;
  snapshotId?: string | undefined;
};
export function routeSearch(state: RouteState) {
  const params = new URLSearchParams({
    region: state.region,
    pollutant: state.pollutant,
    product: state.product,
    mode: state.mode,
  });
  if (state.station) params.set('station', state.station);
  if (state.snapshotId && state.mode === 'historical')
    params.set('snapshotId', state.snapshotId);
  return `?${params}`;
}

export const modeNames = {
  sample: 'Sample',
  historical: 'Historical',
  live: 'Live',
} as const;
