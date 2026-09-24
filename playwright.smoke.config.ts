import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BREPIA_ACCEPTANCE_PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    `Invalid BREPIA_ACCEPTANCE_PORT: ${process.env.BREPIA_ACCEPTANCE_PORT}`,
  );
}
const baseURL = `http://127.0.0.1:${port}`;
const smokeSupabaseUrl =
  process.env.BREPIA_BROWSER_SMOKE_SUPABASE_URL ?? 'http://127.0.0.1:1';

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
      `VITE_SUPABASE_URL=${smokeSupabaseUrl} ` +
      `VITE_SUPABASE_ANON_KEY=browser-smoke-anon-key ` +
      `PCAD_DISABLE_HMR=1 npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/signin`,
    // Fail closed if the requested port is already owned by another process.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
