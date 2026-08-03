import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Tests. Zwei Ebenen:
 *
 *  - **Render-Smoke** (#141): `?demo=chart` mountet die Chart-Ansicht ohne Backend (nur im Dev-Server
 *    verfügbar, weil er an `import.meta.env.DEV` hängt).
 *  - **Auth-Flow** (#174): Anmelden → Termin → Chart → Anmerkung → Abgleich gegen einen
 *    ChurchTools-Stub. Dafür laufen DREI Prozesse: der Stub (`e2e/ct-stub.mjs`), der **echte**
 *    Server (mit seiner echten Session-/Rechte-/Proxy-Logik, nur auf den Stub gerichtet) und der
 *    Client, der `/api` an den Server weiterreicht.
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
  webServer: [
    {
      // Gegenstelle statt echtem ChurchTools – kein Netz, keine echten Zugangsdaten.
      command: 'node e2e/ct-stub.mjs',
      url: 'http://localhost:4599/api/whoami',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Der ECHTE Server, nur auf den Stub gerichtet. SESSION_SECRET ist hier ein Testwert; die
      // Cookie-Verschlüsselung (#194) leitet ihren Schlüssel daraus ab.
      command: 'npm run dev:server',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        CHURCHTOOLS_BASE_URL: 'http://localhost:4599',
        SESSION_SECRET: 'e2e-test-secret-mindestens-32-zeichen-lang',
        ANNOTATIONS_PATH: '.e2e-data/annotations',
        SITE_CONFIG_PATH: '.e2e-data/site.json',
        CAPABILITIES_CACHE_PATH: '.e2e-data/caps.json',
        SEEN_SETLISTS_PATH: '.e2e-data/seen.json',
      },
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
