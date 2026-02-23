import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node esbuild.harness.mjs --serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
