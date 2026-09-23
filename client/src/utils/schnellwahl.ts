import { plusTage, wochenStart } from './wochen';

/*
 * Die Schnellwahl im Fenster „Zeitraum eintragen" (#177) – reine Logik, deshalb hier und nicht in
 * `components/AbsenceSheet.tsx`: Eine Komponentendatei, die zusätzlich Funktionen exportiert, bricht
 * das Fast Refresh von Vite (#406, Lint-Regel `react-refresh/only-export-components`).
 */

/** Die Schnellwahl über den Feldern – die vier Fälle, die es im Musikteam wirklich gibt. */
export const SCHNELLWAHL = [
  { id: 'tag', label: 'Nur dieser Tag' },
  { id: 'we', label: 'Wochenende' },
  { id: 'w1', label: '1 Woche' },
  { id: 'w2', label: '2 Wochen' },
] as const;

export type SchnellwahlId = (typeof SCHNELLWAHL)[number]['id'];

/**
 * Was eine Schnellwahl aus einem Starttag macht. Reine Funktion – ohne Netz und ohne Oberfläche
 * prüfbar. „Wochenende" ist der Samstag+Sonntag der Woche, in der der Starttag liegt; liegt er
 * schon dahinter, das nächste.
 */
export function schnellwahlZeitraum(
  id: SchnellwahlId,
  tag: string,
): { startDate: string; endDate: string } {
  if (id === 'tag') return { startDate: tag, endDate: tag };
  if (id === 'w1') return { startDate: tag, endDate: plusTage(tag, 6) };
  if (id === 'w2') return { startDate: tag, endDate: plusTage(tag, 13) };
  const samstag = plusTage(wochenStart(tag), 5);
  const start = samstag >= tag ? samstag : plusTage(samstag, 7);
  return { startDate: start, endDate: plusTage(start, 1) };
}
