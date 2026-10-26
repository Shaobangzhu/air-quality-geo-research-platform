import type { z } from 'zod';
import type { dataSourceSchema } from '@aq/contracts';

export const SOURCES: z.infer<typeof dataSourceSchema>[] = [
  {
    id: 'synthetic-stations-v1',
    provider: 'synthetic',
    label: 'SYNTHETIC SAMPLE — fictional monitors',
    sourceReference: 'fixture:bff-hourly-v1',
    verification: 'synthetic-fixture-only',
  },
  {
    id: 'airnow-hourly',
    provider: 'airnow',
    label: 'AirNow hourly monitoring-site observations',
    sourceReference: 'https://docs.airnowapi.org/webservices',
    verification: 'capability-documented-wire-contract-unverified',
  },
  {
    id: 'epa-aqs',
    provider: 'aqs',
    label: 'EPA AQS curated historical snapshots',
    sourceReference: 'https://aqs.epa.gov/aqsweb/documents/data_api.html',
    verification: 'curation-required-no-adapter',
  },
];
