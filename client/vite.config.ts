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
      // 'prompt' statt 'autoUpdate': ein neuer Service Worker lädt die laufende App NICHT
      // automatisch mitten im Betrieb neu (störend im Gottesdienst). Das Update wird beim
      // nächsten Kaltstart aktiv, wenn keine Instanz der App mehr offen ist.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo.png'],
      // Manifest wird zur Laufzeit vom Server geliefert (/api/manifest.webmanifest,
      // gebrandet pro Gemeinde). Das Plugin generiert daher KEIN statisches Manifest;
      // der <link rel="manifest"> steht fest in index.html.
      manifest: false,
      workbox: {
        // Offline-Reserve (#32): hochgeladene Dokumente (PDF/Bild) laufzeit-cachen. Ihr Inhalt ist
        // pro fileId unveränderlich (Bearbeiten erzeugt neue Dateien) → CacheFirst. Die Daten-APIs
        // (Termine/Ablauf/ChordPro) werden NICHT hier, sondern über die React-Query-Persistenz
        // (IndexedDB) offline gehalten.
        runtimeCaching: [
          {
            urlPattern: /\/api\/songs\/\d+\/files\/\d+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'worship-files',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
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
