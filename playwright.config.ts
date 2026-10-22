import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** Set E2E_BASE_URL to test a deployed site, e.g. https://mrfreekie.github.io/rigpoint-array-sheet/ */
const LIVE = process.env.E2E_BASE_URL;
const BASE = LIVE ?? `http://localhost:${PORT}/rigpoint-array-sheet/`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  // The tests are heavy (PDF reading, printing, three browser engines): too many at once makes them time out.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // 375 px wide, Safari engine: the narrowest phone the brief requires.
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  // Tests run against the production build, with its Content Security Policy.
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
          url: BASE,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
