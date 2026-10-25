import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// npm workspaces use different working directories; resolve the root consistently.
export function loadEnvironment() {
  config({
    path: fileURLToPath(new URL('../../../.env', import.meta.url)),
    quiet: true,
  });
}
