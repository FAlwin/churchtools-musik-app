/**
 * ESLint-Konfiguration für das ganze Monorepo – EINE Datei (#279).
 *
 * Zwei Dinge sind hier passiert:
 *
 * 1. **ESLint 8 → 9.** ESLint 8.57.1 ist am Ende des Supports; die Flat Config ist ab 9 das Format.
 *    Alle Plugins hier unterstützen 9 (typescript-eslint 8.x sogar bereits 10).
 * 2. **Vier Konfigurationen → eine.** Vorher lagen in `client/`, `server/`, `shared/` und `e2e/` vier
 *    fast identische `.eslintrc.cjs` – dieselbe Regelliste je Datei. Genau die Dopplung, die dieses
 *    Projekt schon mehrfach Geld gekostet hat: `no-explicit-any` stand viermal da, und ob jemand
 *    beim Ergänzen einer Regel alle vier anfasst, war reine Disziplin. Jetzt gibt es die
 *    gemeinsamen Regeln einmal und darüber pro Ordner nur noch das, was wirklich unterschiedlich
 *    ist (Browser- vs. Node-Umgebung, React).
 *
 * Typbewusste Regeln (seit #279) brauchen die Typinformationen. Statt pro Paket ein `project`
 * einzutragen, übernimmt `projectService` das Zuordnen der Dateien zum passenden tsconfig – das ist
 * der von typescript-eslint empfohlene Weg im Monorepo.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Nicht prüfen: Build-Ergebnisse, Abhängigkeiten, Testberichte.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.e2e-data/**',
    ],
  },

  // ── Gemeinsame Basis für ALLE TypeScript-Dateien ─────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Typbewusst: erst damit greifen `no-floating-promises` und `no-misused-promises`. Die Disziplin
  // dafür (`void foo()`) wurde vorher überall von Hand gefahren.
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Dateien, die zu keinem tsconfig gehören (Konfigurationen im Wurzelverzeichnis und die
          // E2E-Tests), bekommen ein Standard-Projekt – sonst bricht die Typinformation ab und die
          // Datei wäre gar nicht prüfbar.
          //  hat sein eigenes tsconfig – hier stehen nur die Tooling-Dateien, für die es
          // keins gibt. Deren typbewusste Prüfung ist unten ausdrücklich abgeschaltet, weil die
          // Typen im Standardprojekt nur halb auflösen und die Meldungen dann Artefakte sind.
          allowDefaultProject: [
            '*.ts',
            '*.mjs',
            '*.js',
            'client/*.ts',
            'excel-sync/*.ts',
            'server/*.ts',
            'e2e/*.mjs',
            'scripts/*.mjs',
            'server/scripts/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Der Code kommt ohne `any` aus – als Fehler festschreiben, damit das so bleibt.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /**
       * `onClick={async () => …}` ist in React ein Idiom und kein Fehler: React ignoriert den
       * Rückgabewert bewusst. 27 Handler umzubauen wäre Lärm ohne Gewinn – die wertvollen Teile der
       * Regel (Promise als Bedingung, Promise an eine void-Funktion) bleiben scharf.
       */
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // ── Client: Browser + React ─────────────────────────────────────────────────
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ── Server, geteiltes Paket, E2E: Node ──────────────────────────────────────
  {
    files: ['server/src/**/*.ts', 'shared/**/*.ts', 'e2e/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },

  // ── Nur der Server: console ist dort das Betriebs-Logbuch ────────────────────
  {
    files: ['server/src/**/*.ts'],
    rules: {
      /**
       * `console` ist auf dem Server das Betriebs-Logbuch – `warn`/`error` sind ausdrücklich
       * erwünscht (Container-Log). `console.log` dagegen soll die Ausnahme bleiben und wird pro
       * Stelle freigegeben (Startmeldung, Beenden).
       *
       * Vorher war die Regel gar nicht aktiv, die fünf `eslint-disable no-console` im Server waren
       * also wirkungslos – aufgefallen ist das erst, weil ESLint 9 ungenutzte Ausnahmen von sich aus
       * meldet. Jetzt ist die Absicht tatsächlich durchgesetzt statt nur kommentiert.
       */
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  /**
   * Testdateien: Die `no-unsafe-*`-Familie und `no-base-to-string` feuern hier auf `JSON.parse(...)`
   * und Mock-Rückgaben – in einem Test ist genau das der normale Umgang mit fremden Daten.
   * `no-floating-promises` bleibt AN, das ist im Test so wichtig wie im Code.
   */
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  /**
   * Tooling-Dateien (Build-/Testkonfiguration, der ChurchTools-Stub in reinem JS): OHNE typbewusste
   * Regeln. Sie gehören zu keinem tsconfig; im Standardprojekt lösen die Typen nur halb auf, und die
   * -Meldungen daraus sind Artefakte der fehlenden Typinformation, keine echten Funde.
   * Syntax, ungenutzte Variablen und  werden weiter geprüft.
   */
  {
    files: [
      '*.ts',
      '*.mjs',
      '*.js',
      'client/*.ts',
      'server/*.ts',
      'e2e/*.mjs',
      'scripts/**/*.mjs',
      'server/scripts/**/*.ts',
    ],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      /**
       * Ausnahme nur hier: `server/scripts/probe-*.ts` sind Wegwerf-Sonden, mit denen die Form der
       * ChurchTools-Antworten überhaupt erst herausgefunden wurde. `any` ist dort die ehrliche
       * Angabe – die Form ist ja unbekannt. Im Anwendungscode bleibt die Regel ein Fehler.
       */
      '@typescript-eslint/no-explicit-any': 'off',
    },
    // Alle diese Dateien laufen unter Node – ohne die Globals meldet ESLint `process`/`console`
    // als undefiniert. `scripts/testplan.mjs` wurde bisher gar nicht geprüft und hatte genau das.
    languageOptions: { globals: globals.node },
  },

  // Formatierung macht Prettier, nicht ESLint – MUSS zuletzt stehen, damit es alle Formatregeln
  // der Blöcke darüber wieder abschaltet (siehe CLAUDE.md: ESLint prüft hier bewusst kein Format).
  prettier,
);
