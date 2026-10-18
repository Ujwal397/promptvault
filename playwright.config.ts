import { defineConfig, devices } from '@playwright/test'

const HARNESS_PORT = 4175
const UI_PORT = 4176

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
] as const

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  webServer: [
    {
      // Test-only privacy harness page. Single shell command works on Windows (cmd/PowerShell) and POSIX.
      command: `npm run build:harness && npx vite preview -c vite.harness.config.ts --port ${HARNESS_PORT} --strictPort`,
      url: `http://127.0.0.1:${HARNESS_PORT}/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // The real production build (with its real CSP), served by vite preview.
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${UI_PORT} --strictPort`,
      url: `http://127.0.0.1:${UI_PORT}/`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
  projects: [
    // Harness tests: unchanged behaviour and project names.
    ...browsers.map(({ name, device }) => ({
      name,
      testMatch: 'privacy.spec.ts',
      use: { ...device, baseURL: `http://127.0.0.1:${HARNESS_PORT}` },
    })),
    // Real-UI tests.
    ...browsers.map(({ name, device }) => ({
      name: `ui-${name}`,
      testMatch: 'ui*.spec.ts',
      use: { ...device, baseURL: `http://127.0.0.1:${UI_PORT}` },
    })),
  ],
})
