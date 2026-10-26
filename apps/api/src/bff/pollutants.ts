import { pollutantSchema } from '@aq/contracts';

// EPA AQS parameter table. Codes identify parameters, not units or averaging periods.
// AirNow wire codes remain unverified and are deliberately not inferred here.
const AQS_PARAMETERS = {
  '88101': 'PM2.5',
  '44201': 'O3',
  '81102': 'PM10',
} as const;
export function normalizePollutant(
  code: unknown,
  vocabulary: 'domain' | 'aqs',
) {
  if (vocabulary === 'domain') return pollutantSchema.safeParse(code).data;
  if (typeof code !== 'string') return undefined;
  return Object.hasOwn(AQS_PARAMETERS, code)
    ? AQS_PARAMETERS[code as keyof typeof AQS_PARAMETERS]
    : undefined;
}
