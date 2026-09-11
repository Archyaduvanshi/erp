import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://localhost:4175', channel: 'chrome', headless: true, screenshot: 'only-on-failure' },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : { command: 'node node_modules/vite/bin/vite.js --host localhost --port 4175 --strictPort', url: 'http://localhost:4175', reuseExistingServer: !process.env.CI },
});
