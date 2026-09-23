/**
 * **„Stand" eines Offline-Vorrats, lesbar** – die eine Stelle (#410, Code-Check 23.09.2026).
 *
 * Die Terminliste (Wolke am Termin) und „Mehr → Offline" formatierten `savedAt` je für sich und waren
 * schon auseinandergelaufen: die eine ohne Jahr, die andere mit. Jetzt gilt dieselbe Regel wie beim
 * Datum überall in der App (`tagKurz`): das Jahr nur, wenn es nicht das laufende ist.
 */
export function standKurz(ms: number, heute = new Date()): string {
  const d = new Date(ms);
  const mitJahr = d.getFullYear() !== heute.getFullYear();
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    ...(mitJahr ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  });
}
