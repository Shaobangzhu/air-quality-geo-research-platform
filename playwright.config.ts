import { defineConfig, devices } from '@playwright/test';

const env = {
  DATA_MODE: 'sample',
  DATABASE_URL: '',
  DB_TARGET_CONFIRMED: '',
  PORT: '3103',
  HOST: '127.0.0.1',
  ALLOW_LIVE_API_TESTS: 'false',
  AIRNOW_API_KEY: '',
  AQS_EMAIL: '',
  AQS_API_KEY: '',
  OPENAI_API_KEY: '',
  VITE_ARCGIS_API_KEY: '',
  AQ_API_PROXY_TARGET: 'http://127.0.0.1:3103',
};
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w @aq/api',
      url: 'http://127.0.0.1:3103/api/health',
      env,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @aq/web -- --port 5174',
      url: 'http://127.0.0.1:5174',
      env,
      reuseExistingServer: false,
    },
  ],
});
