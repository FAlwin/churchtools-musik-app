/**
 * Tages-Helfer der Abwesenheiten (#177). Alles auf `YYYY-MM-DD`-Zeichenketten und UTC gerechnet,
 * damit kein Gerät um Mitternacht einen anderen Tag sieht als ein anderes (siehe `absenceDatum.ts`).
 *
 * Bis zum 19.09.2026 lebte hier auch der Wochenstreifen (`wochenAb`, `wocheTage`, `wocheLabel`); mit
 * dem Umbau auf Monate (`monate.ts`) ist er samt Helfern weg. `wochenStart` bleibt für die
 * Schnellwahl „Wochenende" im Fenster.
 */

const TAG_MS = 86_400_000;

function utc(iso: string): number {
  const [j, m, t] = iso.split('-').map(Number);
  return Date.UTC(j, m - 1, t);
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Heute als `YYYY-MM-DD` in der Zeitzone des Geräts. */
export function heuteIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function plusTage(tag: string, n: number): string {
  return iso(utc(tag) + n * TAG_MS);
}

/** Der Montag der Woche, in der `tag` liegt. */
export function wochenStart(tag: string): string {
  const d = new Date(utc(tag));
  const wt = (d.getUTCDay() + 6) % 7; // Mo = 0 … So = 6
  return plusTage(tag, -wt);
}

const WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Wochentag (Mo…So) eines Tages. */
export function wochentagKurz(tag: string): string {
  return WT_KURZ[(new Date(utc(tag)).getUTCDay() + 6) % 7];
}

/** Tag im Monat als Zahl. */
export function tagImMonat(tag: string): number {
  return Number(tag.slice(8, 10));
}

/** Anzahl Tage von–bis einschließlich. */
export function anzahlTage(von: string, bis: string): number {
  return Math.round((utc(bis) - utc(von)) / TAG_MS) + 1;
}
