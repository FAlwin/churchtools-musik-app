import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Reine Node-Tests. Die Pflicht-Env steht hier, damit `config.ts` beim Import nicht wirft; die
// Werte sind erfunden – kein Test spricht ein echtes System an.
export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      CHURCHTOOLS_BASE_URL: 'https://test.church.tools',
      CHURCHTOOLS_SERVICE_TOKEN: 'test-token',
      AZURE_TENANT_ID: 'tenant',
      AZURE_CLIENT_ID: 'client',
      AZURE_CLIENT_SECRET: 'secret',
      ONEDRIVE_USER: 'jemand@example.org',
      EXCEL_FILE_ID: 'datei',
      SYNC_DRY_RUN: 'true',
    },
  },
});
