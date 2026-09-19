/**
 * Monats-Helfer für die Abwesenheiten (#177, Monatsansicht seit 19.09.2026).
 *
 * Ein Monat ist hier ein String `YYYY-MM` – so vergleicht er sich mit `<` wie die `YYYY-MM-DD`-Tage
 * aus ChurchTools, ohne Zeitzone und ohne `Date`-Mitternachts-Fallen (siehe `wochen.ts`). Alles rein
 * und ohne Netz prüfbar.
 */
const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;
const MONATE_KURZ = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

/** `2026-10-04` → `2026-10`. */
export function monatVon(tag: string): string {
  return tag.slice(0, 7);
}

/** `2026-10` + 3 → `2027-01`; negative Werte gehen zurück. */
export function monatPlus(monat: string, n: number): string {
  const jahr = Number(monat.slice(0, 4));
  const idx = Number(monat.slice(5, 7)) - 1 + n;
  const j = jahr + Math.floor(idx / 12);
  const m = ((idx % 12) + 12) % 12;
  return `${j}-${String(m + 1).padStart(2, '0')}`;
}

/** `2026-10` → „Oktober 2026". */
export function monatLabel(monat: string): string {
  return `${MONATE[Number(monat.slice(5, 7)) - 1]} ${monat.slice(0, 4)}`;
}

/** `2026-10` → „Okt 26" – für die Pills der Monatsleiste. */
export function monatKurz(monat: string): string {
  return `${MONATE_KURZ[Number(monat.slice(5, 7)) - 1]} ${monat.slice(2, 4)}`;
}

/** `2026-10` → „Okt" – für das Raster, wo das Jahr darüber steht. */
export function monatNurKurz(monat: string): string {
  return MONATE_KURZ[Number(monat.slice(5, 7)) - 1];
}

/** `anzahl` Monate ab dem Monat des Tages, der erste ist der laufende. */
export function monateAb(heute: string, anzahl: number): string[] {
  const start = monatVon(heute);
  return Array.from({ length: anzahl }, (_, i) => monatPlus(start, i));
}

/** Letzter Tag des Monats als `YYYY-MM-DD` – Schaltjahre inklusive (UTC, wie alles hier). */
export function letzterTag(monat: string): string {
  const jahr = Number(monat.slice(0, 4));
  const m = Number(monat.slice(5, 7));
  const tage = new Date(Date.UTC(jahr, m, 0)).getUTCDate();
  return `${monat}-${String(tage).padStart(2, '0')}`;
}
