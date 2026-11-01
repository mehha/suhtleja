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
  // Two workers on CI: each makes its own test accounts, so they don't get in each other's way, and
  // the deploy waits about half as long for the browser tests.
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    locale: 'et-EE',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  // A computer, phones and tablets. iPhones and iPads run WebKit (Safari's engine); Android runs
  // Chromium. Tablets are where the child's boards are used most; the device tests
  // (devices*.e2e.spec.ts) run on every touch screen and also turn it sideways. The member flow test
  // is long and speaks through the real speech service, so it runs on the computer and the Android
  // phone only. On the CI runner WebKit kept failing it now and then, in ways that never showed
  // locally; the device tests cover the iPad.
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
      testIgnore: /member-flow/,
    },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'] },
      testIgnore: /member-flow/,
    },
    {
      name: 'android-tablet',
      use: { ...devices['Galaxy Tab S4'] },
      testIgnore: /member-flow/,
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
