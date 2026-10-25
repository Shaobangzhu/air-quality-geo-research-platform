import { defineConfig, devices } from '@playwright/test';

const env = {
  DATA_MODE: 'sample',
  DATABASE_URL: '',
  DB_TARGET_CONFIRMED: '',
  PORT: '3001',
  HOST: '127.0.0.1',
  ALLOW_LIVE_API_TESTS: 'false',
};
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w @aq/api',
      url: 'http://127.0.0.1:3001/api/health',
      env,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @aq/web',
      url: 'http://127.0.0.1:5173',
      env,
      reuseExistingServer: false,
    },
  ],
});
