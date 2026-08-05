/* ESLint-Konfiguration für das geteilte Paket.
 *
 * Warum es diese Datei überhaupt braucht (#278): `shared/` enthält seit #250 nicht mehr nur Typen,
 * sondern **Laufzeit-Code** (die Schlüssel-Grammatik in `keys/`), den Client UND Server importieren.
 * Geprüft wurde er trotzdem nie: Ohne `lint`-Skript überspringt `npm run lint --workspaces
 * --if-present` den Workspace stillschweigend, und ohne Konfiguration bricht ESLint hier ab.
 * Typgeprüft wird der Ordner transitiv über die beiden Builds – nur der Lint fehlte.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { es2022: true },
  rules: {
    // Wie in client/ und server/: kein `any` – hier besonders wichtig, weil beide Seiten darauf bauen.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
};
