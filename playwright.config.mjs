import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tmp/site-e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-1440',
      use: { viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'node scripts/site/serve.mjs',
    url: baseURL,
    env: { SITE_HOST: '127.0.0.1', SITE_PORT: '4174' },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
