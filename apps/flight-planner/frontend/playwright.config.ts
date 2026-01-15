import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: '../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/api/health',
      cwd: '../backend',
      reuseExistingServer: !process.env.CI,
      env: {
        DISABLE_METAR_FETCH: '1',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      cwd: '.',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
