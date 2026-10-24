import { defineConfig } from '@playwright/test'

// Needs Stripe test keys + Sanity products in .env and `stripe listen` running; see README.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  // en-US so Stripe's hosted Checkout renders English labels for the locators.
  use: { baseURL: 'http://localhost:3000', locale: 'en-US', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
})
