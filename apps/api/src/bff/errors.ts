import type { ErrorCode } from '@aq/contracts';

const messages: Record<ErrorCode, string> = {
  ROUTE_NOT_FOUND: 'Unknown API route.',
  INVALID_REQUEST:
    'Invalid query or station ID. See the documented bounds and accepted fields.',
  STATION_NOT_FOUND:
    'Station is not present in the selected mode, pollutant and time window.',
  SNAPSHOT_REQUIRED: 'Historical mode requires an identified local snapshotId.',
  SNAPSHOT_NOT_FOUND: 'The requested local snapshot does not exist.',
  SNAPSHOT_MODE_MISMATCH:
    'The selected snapshot is not an official historical snapshot.',
  UNSUPPORTED_RANGE:
    'Requested time or extent is outside the supported study/snapshot bounds.',
  PROVIDER_NOT_CONFIGURED:
    'The selected live provider is not configured on the server.',
  PROVIDER_CONTRACT_UNVERIFIED:
    'AirNow hourly request/response details require verified official specifications before live access can be enabled.',
  UPSTREAM_RATE_LIMITED: 'The provider is rate-limiting requests; retry later.',
  UPSTREAM_SERVER_ERROR: 'The provider returned a server error.',
  UPSTREAM_REJECTED:
    'The provider rejected the request; check server-side provider configuration.',
  UPSTREAM_TIMEOUT:
    'The provider did not complete the request within the bounded timeout.',
  UPSTREAM_NETWORK: 'The provider could not be reached.',
  UPSTREAM_FORMAT: 'The provider returned an unsupported response format.',
  UPSTREAM_TOO_LARGE:
    'The provider/import exceeded the bounded payload or record limit.',
  UPSTREAM_MALFORMED:
    'The provider/import payload could not be validated safely.',
  DATABASE_UNAVAILABLE:
    'The project snapshot database is unavailable or has not been migrated.',
  STORAGE_LIMIT:
    'The bounded snapshot store is full; no stored data was removed.',
  BUSY: 'The bounded request queue is full; retry later.',
  INTERNAL_ERROR: 'The request could not be completed safely.',
};
export class BffError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status = 503,
    public readonly retryable = false,
  ) {
    super(messages[code]);
  }
}
export function safeError(error: unknown): BffError {
  return error instanceof BffError
    ? error
    : new BffError('INTERNAL_ERROR', 500);
}
