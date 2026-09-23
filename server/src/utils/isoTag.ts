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

/**
 * **Der Tag eines ChurchTools-Zeitpunkts** (`2026-10-04T08:00:00Z` → `2026-10-04`) – die eine Stelle
 * (#410). Stand bis zum 23.09.2026 als `startDate.slice(0, 10)` dreimal im Server (Termine,
 * Ablauf-Aufbau, Abwesenheiten).
 *
 * ⚠️ Das ist der Tag, **wie er im Text steht** – bei ChurchTools also der **UTC-Tag** (gemessen: die
 * Termine kommen als `…Z`). Ein Termin um 0:30 Uhr deutscher Zeit (22:30 Z) landete damit auf dem
 * Vortag. Bisher nie vorgekommen, deshalb bewusst nicht mitgeändert: Die Abwesenheiten schreiben
 * genau diesen Tag nach ChurchTools, eine Umstellung müsste beide Seiten zugleich treffen. Wenn es
 * nötig wird, dann HIER – eine Stelle statt drei.
 */
export function tagAusIso(zeitpunkt: string): string {
  return zeitpunkt.slice(0, 10);
}
