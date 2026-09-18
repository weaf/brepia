import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: 'browser_smoke.acceptance.ts',
  outputDir: 'test-results/playwright-smoke',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list']],
  webServer: {
    command:
      `VITE_SUPABASE_URL=http://127.0.0.1:54321 ` +
      `VITE_SUPABASE_ANON_KEY=browser-smoke-anon-key ` +
      `PCAD_DISABLE_HMR=1 npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
