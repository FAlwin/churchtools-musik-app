import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Eigene Vitest-Config (ohne PWA-Plugin) – testet nur reine Logik in src/utils.
// Environment 'node', da keine DOM-Abhängigkeit.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**'],
      reporter: ['text', 'html'],
    },
  },
});
