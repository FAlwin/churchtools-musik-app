/* ESLint-Konfiguration für das Client-Paket */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  env: { browser: true, es2022: true },
  settings: { react: { version: '18.3' } },
  rules: {
    // Der Code kommt ohne `any` aus – als Fehler festschreiben, damit das so bleibt.
    '@typescript-eslint/no-explicit-any': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
