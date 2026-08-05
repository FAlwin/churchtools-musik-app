/* ESLint-Konfiguration für das Client-Paket */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    // Nötig für die typbewussten Regeln (#279).
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // Typbewusste Regeln (#279): Erst damit greifen `no-floating-promises` und
    // `no-misused-promises` – die Disziplin (`void foo()`) wurde vorher überall von HAND gefahren.
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  env: { browser: true, es2022: true },
  settings: { react: { version: '18.3' } },
  rules: {
    /**
     * `onClick={async () => …}` ist in React ein Idiom und kein Fehler (#279): React ignoriert den
     * Rückgabewert bewusst. 27 Handler umzubauen wäre Lärm ohne Gewinn – die eigentlich wertvollen
     * Teile der Regel (Promise als Bedingung, Promise an eine void-Funktion) bleiben scharf.
     */
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
    // Der Code kommt ohne `any` aus – als Fehler festschreiben, damit das so bleibt.
    '@typescript-eslint/no-explicit-any': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      /**
       * Testdateien: Die `no-unsafe-*`-Familie und `no-base-to-string` feuern hier auf
       * `JSON.parse(...)` und Mock-Rückgaben – in einem Test ist genau das der normale Umgang mit
       * fremden Daten. `no-floating-promises` bleibt AN, das ist im Test so wichtig wie im Code.
       */
      files: ['**/*.test.ts', '**/*.test.tsx'],
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
  ],
};
