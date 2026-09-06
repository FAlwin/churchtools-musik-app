/**
 * Wochen-Helfer für den Wochenstreifen der Verfügbarkeit (#177, Variante C – Entscheidung Alwin,
 * 05.09.2026). Alles auf `YYYY-MM-DD`-Zeichenketten und UTC gerechnet, damit kein Gerät um
 * Mitternacht eine andere Woche sieht als ein anderes (siehe `absenceDatum.ts`).
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

/** Die sieben Tage ab Montag. */
export function wocheTage(montag: string): string[] {
  return Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
}

/** Die Montage der nächsten `anzahl` Wochen ab der Woche von `heute`. */
export function wochenAb(heute: string, anzahl: number): string[] {
  const start = wochenStart(heute);
  return Array.from({ length: anzahl }, (_, i) => plusTage(start, i * 7));
}

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
];
const MONATE_KURZ = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sept.',
  'Okt.',
  'Nov.',
  'Dez.',
];

/** „14. – 20. September" bzw. über den Monatswechsel „28. Sept. – 4. Okt.". */
export function wocheLabel(montag: string): string {
  const [, m1, t1] = montag.split('-').map(Number);
  const sonntag = plusTage(montag, 6);
  const [, m2, t2] = sonntag.split('-').map(Number);
  if (m1 === m2) return `${t1}. – ${t2}. ${MONATE[m1 - 1]}`;
  return `${t1}. ${MONATE_KURZ[m1 - 1]} – ${t2}. ${MONATE_KURZ[m2 - 1]}`;
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

/**
 * Kurzform für die schmale Auswahlleiste: „15.09." bzw. „15.09. – 17.09.".
 *
 * Ohne Wochentag – der steht im Streifen direkt über der Leiste, und mit ihm passte die Zeile auf
 * dem Handy nicht mehr neben die beiden Knöpfe (im Browser gesehen, 05.09.2026).
 */
export function zeitraumKompakt(von: string, bis?: string): string {
  const tag = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  return !bis || bis === von ? tag(von) : `${tag(von)} – ${tag(bis)}`;
}
