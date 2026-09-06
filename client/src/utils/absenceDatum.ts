import type { Absence } from '@shared/types/index';

/**
 * Datums-Helfer für die Verfügbarkeit (#177). Alles rein und ohne Zeitzone: Die Tage kommen als
 * `YYYY-MM-DD` aus ChurchTools und werden als solche verglichen – ein `new Date('2026-10-04')` wäre
 * UTC-Mitternacht und in Deutschland der Vorabend.
 */

/** Liegt der Tag innerhalb der Abwesenheit (einschließlich)? */
export function deckt(a: Absence, tag: string): boolean {
  return a.startDate <= tag && tag <= a.endDate;
}

/** Die Abwesenheit, die den Tag abdeckt – eigene zuerst, damit „Abmelden zurücknehmen" sie trifft. */
export function abwesenheitFuer(alle: Absence[], tag: string): Absence | undefined {
  return alle.find((a) => a.eigene && deckt(a, tag)) ?? alle.find((a) => deckt(a, tag));
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** `2026-10-04` → „So, 04.10." – ohne Jahr, wenn es das laufende ist. */
export function tagKurz(iso: string, heute = new Date()): string {
  const [j, m, t] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  const jahr = j === heute.getFullYear() ? '' : `${j}`;
  return `${WOCHENTAGE[d.getUTCDay()]}, ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.${jahr}`;
}

/** Zeitraum lesbar: ein Tag → „So, 04.10."; mehrere → „Sa, 03.10. – So, 11.10.". */
export function zeitraumKurz(
  a: Pick<Absence, 'startDate' | 'endDate'>,
  heute = new Date(),
): string {
  return a.startDate === a.endDate
    ? tagKurz(a.startDate, heute)
    : `${tagKurz(a.startDate, heute)} – ${tagKurz(a.endDate, heute)}`;
}

/** Uhrzeit aus einem ISO-Zeitpunkt in der Zeitzone des Geräts – „10:00". */
export function uhrzeit(isoZeitpunkt: string): string {
  const d = new Date(isoZeitpunkt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
