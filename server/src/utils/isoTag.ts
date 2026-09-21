/**
 * **Ein Zeitpunkt als `YYYY-MM-DD` – die eine Stelle im Server.**
 *
 * Gerechnet wird in **UTC**, und das ist hier richtig: Die Werte gehen als Zeitfenster (`from`/`to`)
 * an ChurchTools, der Server läuft im Container ohne gesetzte Zeitzone, und ein Fenster von einer
 * Woche bis sechs Wochen verträgt eine Stunde Verschiebung. Der **Client** hat dafür eine eigene
 * Stelle (`utils/heute.ts`), die absichtlich LOKAL rechnet: Dort geht es um die Frage, welcher Tag
 * für den Nutzer „heute" ist, und die beantwortet UTC zwischen Mitternacht und 2 Uhr falsch.
 *
 * Bis zum 21.09.2026 stand diese eine Zeile im Server an drei Stellen (`absences`,
 * `setlistController`, `setlistBuilder`) – zusammengeführt im Code-Check.
 */
export function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}
