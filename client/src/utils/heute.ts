/**
 * **Heute als `YYYY-MM-DD` – die eine Stelle dafür im Client.**
 *
 * Bewusst aus den **lokalen** Feldern des Datums gebaut und NICHT über `toISOString().slice(0, 10)`:
 * Letzteres liefert den Tag in UTC. In Deutschland ist das zwischen Mitternacht und 2 Uhr der
 * **Vortag** – wer um 0:30 Uhr die Termine öffnete, sah den gerade zu Ende gegangenen Gottesdienst
 * noch als „anstehend", und `pruneOfflineRegistry` hätte ihn noch nicht aufgeräumt.
 *
 * Gefunden im Code-Check am 21.09.2026: Die Abwesenheiten rechneten lokal, sechs andere Stellen in
 * UTC – dieselbe Frage mit zwei Antworten. Alle Vergleiche laufen gegen Termindaten aus
 * ChurchTools, und die sind in der Zeitzone der Gemeinde gemeint.
 */
export function heuteIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
