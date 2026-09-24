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
    // Standard 'node' (reine Logik); Komponenten-Tests (*.test.tsx) setzen
    // ihre Umgebung per `// @vitest-environment jsdom`-Docblock selbst.
    environment: 'node',
    /**
     * **Jeder Test beginnt mit frischen Spionen** (#405, beim Wechsel auf vitest 4). vitest 4
     * ÜBERNIMMT bei einem zweiten `vi.spyOn` auf dieselbe Methode den bestehenden Spion samt seiner
     * Aufrufe (vitest 3 legte einen neuen an). Ein Test, der seine Spione nicht selbst aufräumt, las
     * dadurch die Logzeile des VORIGEN Tests – `songUsage.test.ts` fiel so auf. Schlimmer wäre der
     * andere Fall: eine fremde Zeile, die zufällig passt, und ein Test, der fälschlich grün ist.
     * Hier einmal für alle geregelt, statt es jeder Testdatei zu überlassen.
     */
    restoreMocks: true,
    // …und mit leerer Aufrufliste aller Attrappen: `restoreMocks` setzt in vitest 4 nur Spione zurück,
    // die Aufrufe von `vi.fn()` aus `vi.mock` zählten über Testgrenzen weiter (beim Schreiben der
    // Anmelde-Schlüssel-Tests am 23.09.2026 aufgefallen: „nicht aufgerufen" scheiterte an den
    // Aufrufen des vorigen Tests). Dieselbe Fehlerklasse, dieselbe Antwort: einmal hier.
    clearMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // Baut gerenderte Komponenten/Hooks nach jedem Test ab – ohne das bleiben sie samt ihrer
    // window-Listener am Leben und mischen sich in spätere Tests ein (#314).
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/components/**', 'src/hooks/**', 'src/services/**'],
      reporter: ['text', 'html'],
    },
  },
});
