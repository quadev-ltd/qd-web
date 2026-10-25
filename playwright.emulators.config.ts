import { defineConfig } from '@playwright/test';

// End-to-end tests against the real backend code: the site is built with the Firebase
// gateway and talks to the emulators of quadev-backend (Auth, Firestore, Functions and
// Storage, project demo-quadev), which run the real functions with a fake model. They prove
// the contract between the two repositories; the screens themselves are proven by the
// specs and by the tests in e2e/ (docs/adr/0007-interview-profile.md).
//
// The emulators must be running: `yarn e2e:emulators` starts them from a checkout of
// quadev-backend (scripts/e2e-emulators.sh). `yarn playwright test -c
// playwright.emulators.config.ts` runs the tests alone against emulators already started.
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e-emulators',
  outputDir: './test-results-emulators',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ['list'],
        [
          'html',
          { open: 'never', outputFolder: 'playwright-report-emulators' },
        ],
      ]
    : 'list',
  // A first call starts a function in the emulator, and the first reading loads the
  // service's bundle (with pdf.js): several seconds each, more on a first run after `npm ci`
  // in the backend. A test waits for up to three readings.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // As in playwright.config.ts: the interviews' times in one zone (D89).
    timezoneId: 'Europe/London',
    locale: 'en-GB',
  },
  // One size: the phone layout adds nothing to a test of the contract.
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `yarn build:e2e-emulators && yarn preview:e2e-emulators --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // A dev-mode build with the Firebase gateway, sent to the emulators. `demo-` projects
    // never reach a real Google service; the other values only have to be present.
    env: {
      VITE_ACCOUNT_ENABLED: 'true',
      VITE_AUTH_GATEWAY: 'firebase',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-quadev',
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-quadev.firebaseapp.com',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
      // The bucket the Functions emulator gives the functions of demo-quadev.
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-quadev.appspot.com',
    },
  },
});
