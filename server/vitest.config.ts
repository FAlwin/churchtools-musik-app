import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Server-Tests: reine Node-Umgebung (kein DOM). `@shared`-Alias wie im Quellcode.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Pflicht-Env setzen, bevor config.ts beim Import ausgewertet wird (sonst wirft es).
    env: {
      CHURCHTOOLS_BASE_URL: 'https://test.church.tools',
      SESSION_SECRET: 'test-secret-for-unit-tests',
      NODE_ENV: 'test',
    },
  },
});
