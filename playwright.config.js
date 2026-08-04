import { defineConfig } from '@playwright/test'

const e2ePort = Number(globalThis.process?.env?.PLAYWRIGHT_PORT || 4178)

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: false,
  },
})
