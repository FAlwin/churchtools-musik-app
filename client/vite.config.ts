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
      // automatisch mitten im Betrieb neu (störend im Gottesdienst). Updates kommen über den
      // Hinweis-Balken (useSwUpdate) bzw. beim nächsten Kaltstart. (Bewusste Entscheidung aus
      // v2.5.0 – NICHT wieder auf autoUpdate stellen.)
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo.png'],
      // Manifest wird zur Laufzeit vom Server geliefert (/api/manifest.webmanifest,
      // gebrandet pro Gemeinde). Das Plugin generiert daher KEIN statisches Manifest;
      // der <link rel="manifest"> steht fest in index.html.
      manifest: false,
      workbox: {
        // Neuer Service Worker aktiviert sich SOFORT (kein „wartender SW"), statt bis zum manuellen
        // Umschalten zu warten. Genau dieser Schwebezustand ließ die PWA auf iOS beim Kaltstart
        // OHNE Netz weiß bleiben: der wartende SW übernahm die Navigation nicht → Shell kam nicht aus
        // dem Cache. skipWaiting+clientsClaim beseitigt das; cleanupOutdatedCaches räumt alte
        // Precaches auf. Es wird KEIN automatischer Reload ausgelöst (registerType bleibt 'prompt') →
        // die laufende App lädt nie ungefragt mitten im Gottesdienst neu. (#32)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache MUSS `.mjs` (+ Fonts/wasm) einschließen – sonst fehlt offline der pdf.js-Worker
        // (pdf.worker.min.mjs) und das Rendern der Charts scheitert mit „fake worker failed" (#32).
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,wasm}'],
        // pdf.js-Chunks sind groß → Precache-Grenze anheben (Default 2 MiB).
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
