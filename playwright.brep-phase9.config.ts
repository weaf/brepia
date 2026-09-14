import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'brep_phase9_roundtrip.acceptance.ts',
  timeout: 600000,
  expect: {
    timeout: 30000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list'], ['html', { outputFolder: 'brep-phase9-report' }]],
});
