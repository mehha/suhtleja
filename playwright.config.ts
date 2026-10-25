import { defineConfig, devices } from '@playwright/test'

import dotenv from 'dotenv'

// The env files `next dev` reads, in its order, so the member flow test signs Stripe webhooks with
// the secret the local server checks.
dotenv.config({ path: ['.env.development.local', '.env.local', '.env.development', '.env'] })

// Smoke tests only read public pages, so they can run against a local dev server (default) or a
// deployed site: `SMOKE_BASE_URL=https://suhtleja.ee pnpm test:e2e`. The member flow test creates an
// account, so it runs only against the local server; the global teardown deletes the account.
const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const testsLocalServer = !process.env.SMOKE_BASE_URL

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    locale: 'et-EE',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  globalTeardown: testsLocalServer ? './tests/e2e/global-teardown.ts' : undefined,
  webServer: testsLocalServer
    ? {
        command: 'pnpm dev',
        reuseExistingServer: true,
        // A page that answers 200 even with an empty database (CI). The first compile is slow.
        url: new URL('/login', baseURL).href,
        timeout: 180_000,
      }
    : undefined,
})
