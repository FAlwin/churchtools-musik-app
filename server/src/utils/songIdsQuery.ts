/**
 * Lied-IDs aus einem Query-Parameter (`?songs=1,2,3`) lesen – EINE Stelle für alle Endpunkte (#279).
 *
 * Zwei Gründe für diese Datei:
 *
 * 1. **Die Regel stand dreimal**: `annotationsController`, `userSettingsController` und
 *    `teamNotesController` hatten je ihre eigene, wortgleiche Kopie derselben vier Zeilen.
 * 2. **Alle drei behandelten den Typ falsch.** `req.query.songs` ist bei Express NICHT immer ein
 *    String: Bei `?songs=a&songs=b` kommt ein Array, bei `?songs[x]=1` ein **Objekt**. `String(obj)`
 *    ergibt dann `"[object Object]"`. Gefunden hat das die typbewusste Regel `no-base-to-string` –
 *    von Hand war es niemandem aufgefallen.
 *
 * Gefährlich war das nicht (aus `[object Object]` entsteht keine gültige ID, die Filterung fängt es),
 * aber es ist genau die Art unsauberer Eingabe-Behandlung, die später jemand kopiert.
 */
export function songIdsFromQuery(value: unknown): number[] {
  const raw =
    typeof value === 'string'
      ? value
      : // `?songs=1&songs=2` → Array. Nur die String-Einträge zählen; alles andere ignorieren.
        Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string').join(',')
        : ''; // Objekt oder nicht gesetzt → keine IDs
  return raw
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}
