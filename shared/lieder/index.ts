/**
 * Lieder – geteilte Regeln für App und Server (#322, erweitert am 20.09.2026 für #395).
 *
 * Hier steht, was auf beiden Seiten **gleich** entschieden werden muss. Alles andere bleibt dort, wo
 * es hingehört: Die Blockade gegen ein Doppel ist und bleibt Sache des Servers
 * (`server/src/services/songVerwaltung.ts`) – eine Prüfung nur in der Oberfläche umginge jeder, der
 * den Endpunkt direkt aufruft.
 */

/**
 * **Die CCLI-Nummer vergleichbar machen – die eine Stelle.**
 *
 * Verglichen wird **getrimmter Text, nie eine Zahl.** ChurchTools liefert `ccli` als Zeichenkette
 * (`"5841527"`); als Zahl gelesen verlöre eine Nummer mit führender Null ihre Identität, und
 * `Number('')` wäre `0` – also ein Treffer bei jedem Lied ohne Nummer.
 *
 * Leerer String = **keine Nummer**. Ohne Nummer gibt es nichts sicher zu vergleichen; dann bleibt nur
 * die Warnung über den Namen, und die blockiert bewusst nicht (gleiche Titel sind bei Liedern normal).
 *
 * Stand bis zum 20.09.2026 nur im Server. Seit die App vor dem Anlegen fragt, ob es das Lied schon
 * gibt, brauchen beide dieselbe Antwort – als zwei Kopien wäre genau hier die nächste Abweichung
 * gelandet.
 */
export function ccliSchluessel(ccli: string | number | null | undefined): string {
  return String(ccli ?? '').trim();
}
