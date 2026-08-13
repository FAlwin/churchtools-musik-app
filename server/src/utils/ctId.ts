/**
 * Eine ChurchTools-ID aus einem unbekannten Wert lesen – **`0` ist eine gültige ID** (#322).
 *
 * **Warum das eine eigene Stelle ist:** `Number(null)` ergibt `0`, und `Number.isInteger(0)` ist
 * `true`. Wer also naiv `werte.map(Number).filter(Number.isInteger)` schreibt, verwandelt jedes
 * `null` in die ID 0 – und bei den Lied-Kategorien heißt 0 „Aktive Songs". Genau dieser Fehler stand
 * beim ersten Wurf von Schritt 7 an **zwei** Stellen (Rechte-Liste und Kategorie-Liste); ein Test hat
 * ihn gefunden, kein Compiler hätte es getan.
 *
 * **Warum nicht `songIdsFromQuery`:** Der Helfer für Query-Parameter verlangt `n > 0` und würde
 * Kategorie 0 verschlucken. Zwei verschiedene Regeln, zwei Funktionen – aber jede nur einmal.
 *
 * Zeichenketten sind ausdrücklich erlaubt: Die alte ChurchTools-Schnittstelle liefert IDs als `"0"`.
 * Ein leerer oder rein weißer Text ist **keine** ID (`Number('')` wäre wieder 0).
 */
export function ctId(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  }
  // `null`, `undefined`, `true`, Objekte, leere Zeichenketten – nichts davon ist eine ID.
  return null;
}
