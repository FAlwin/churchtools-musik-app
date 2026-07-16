import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Smoke (#141). Fährt den Vite-Dev-Server hoch (dort ist `import.meta.env.DEV` true → der
 * `?demo=chart`-Modus ist verfügbar, der die Chart-Ansicht OHNE ChurchTools-Login mit Testliedern
 * mountet). Ein voller Auth-Flow (Login→Agenda→Sync) bräuchte einen CT-Stub → eigenes Folge-Issue.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev:client',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
