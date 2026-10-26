import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { BffError } from '../apps/api/src/bff/errors.js';

loadEnvironment();
try {
  const config = readConfig();
  if (!config.ALLOW_LIVE_API_TESTS) {
    console.info(
      'NOT RUN: ALLOW_LIVE_API_TESTS is false. No provider request made.',
    );
    process.exitCode = 2;
  } else if (!config.AIRNOW_API_KEY)
    throw new BffError('PROVIDER_NOT_CONFIGURED');
  else throw new BffError('PROVIDER_CONTRACT_UNVERIFIED');
} catch (error) {
  console.error(
    error instanceof BffError
      ? `${error.code}: ${error.message} No provider request made.`
      : 'Provider verification configuration is invalid.',
  );
  process.exitCode = 1;
}
