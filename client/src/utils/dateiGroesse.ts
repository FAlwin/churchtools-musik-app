/**
 * Eine Dateigröße für Menschen (#321).
 *
 * Eigene Datei, weil es eine **reine** Funktion ist und damit in Sekunden prüfbar – anders als
 * dieselbe Rechnung inline in der Liste, wo man sie nur durch Anklicken der Oberfläche testen kann.
 *
 * **`null` heißt „unbekannt", nicht „leer".** ChurchTools liefert die Größe nicht immer mit; dann
 * steht ein Gedankenstrich da. „0 KB" wäre eine Behauptung über die Datei.
 */
const KB = 1024;

export function dateiGroesse(bytes: number | null): string {
  if (bytes === null) return '–';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} KB`;
  // Ab einem Megabyte mit einer Nachkommastelle: „1,4 MB" sagt mehr als „1 MB", und mehr als eine
  // Stelle liest ohnehin niemand.
  const mb = bytes / (KB * KB);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}
