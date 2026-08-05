/* ESLint-Konfiguration für die E2E-Tests (#278).
 *
 * Der Ordner fiel bisher aus der Prüfung: Client und Server linten nur ihr eigenes `src`, und `e2e/`
 * ist kein Workspace. Hier liegt aber echter Code – der Playwright-Flow und der ChurchTools-Stub.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
};
