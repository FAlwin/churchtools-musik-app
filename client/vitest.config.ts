import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Eigene Vitest-Config (ohne PWA-Plugin).
// Standard-Environment 'node' (reine Logik); Komponenten-Tests (*.test.tsx)
// laufen in jsdom (per environmentMatchGlobs).
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/components/**'],
      reporter: ['text', 'html'],
    },
  },
});
