import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // geteilte Typen: @shared/... -> ../shared/...
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      // Manifest wird zur Laufzeit vom Server geliefert (/api/manifest.webmanifest,
      // gebrandet pro Gemeinde). Das Plugin generiert daher KEIN statisches Manifest;
      // der <link rel="manifest"> steht fest in index.html.
      manifest: false,
    }),
  ],
  // Moderne Sass-API verwenden (vermeidet die „legacy-js-api"-Deprecation-Warnung)
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
  server: {
    port: 5173,
    // host: true -> auch im WLAN erreichbar (zum Testen auf Handy/Tablet)
    host: true,
    // Proxy: API-Aufrufe im Dev an das Express-Backend weiterreichen
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
