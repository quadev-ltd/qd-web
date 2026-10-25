import { defineConfig } from '@playwright/test';

// End-to-end tests (the web equivalent of the app's Maestro flows). They run against a
// real build served by `vite preview`, with the account screens on and the preview auth
// gateway: an in-memory fake, so no backend is needed. The build uses the dev mode, never
// the production one (a production build refuses the preview gateway).
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // GitHub's runners for a public repository have 4 cores; the default uses half of them.
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // The interviews' times are shown in the browser's zone (D89): one zone, whatever the
    // computer's, so a run says the same things everywhere.
    timezoneId: 'Europe/London',
    locale: 'en-GB',
  },
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'phone',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `yarn build:e2e && yarn preview:e2e --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_ACCOUNT_ENABLED: 'true',
      VITE_AUTH_GATEWAY: 'preview',
    },
  },
});
