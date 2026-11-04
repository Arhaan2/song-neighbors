import { defineConfig } from '@playwright/test'

const port = Number(process.env.PREVIEW_PORT ?? 4173)
const baseURL = process.env.RELEASE_BASE_URL ?? `http://127.0.0.1:${port}/song-neighbors/`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.RELEASE_BASE_URL ? undefined : {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    // Reuse is explicit so an unrelated old preview cannot silently pass this suite.
    reuseExistingServer: process.env.REUSE_PREVIEW === '1',
    timeout: 15_000,
  },
})
