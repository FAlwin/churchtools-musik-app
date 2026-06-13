import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { branding } from './src/config/branding';

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
      manifest: {
        name: branding.appName,
        short_name: branding.shortName,
        description: branding.description,
        theme_color: branding.themeColor,
        background_color: branding.backgroundColor,
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
