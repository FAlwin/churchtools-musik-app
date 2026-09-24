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
    include: ['src/**/*.test.ts'],
    // Pflicht-Env setzen, bevor config.ts beim Import ausgewertet wird (sonst wirft es).
    env: {
      CHURCHTOOLS_BASE_URL: 'https://test.church.tools',
      SESSION_SECRET: 'test-secret-for-unit-tests',
      NODE_ENV: 'test',
    },
  },
});
