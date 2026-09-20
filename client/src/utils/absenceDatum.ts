import type { Absence } from '@shared/types/index';
import { wochentagKurz } from './wochen';

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
  return alle.find((a) => a.vonApp && deckt(a, tag)) ?? alle.find((a) => deckt(a, tag));
}

/**
 * `2026-10-04` → „So, 04.10." – ohne Jahr, wenn es das laufende ist.
 *
 * Den Wochentag rechnet `wochentagKurz` aus `./wochen` – dort steht das eine UTC-Parsen von
 * `YYYY-MM-DD`. Hier stand bis zum 18.09.2026 eine zweite Fassung samt eigener Wochentagsliste
 * (gefunden bei der Dopplungs-Suche im `/festhalten`). Tag, Monat und Jahr kommen als Text direkt
 * aus dem ISO-String – zweistellig sind sie dort schon.
 */
export function tagKurz(iso: string, heute = new Date()): string {
  const jahr = Number(iso.slice(0, 4)) === heute.getFullYear() ? '' : iso.slice(0, 4);
  return `${wochentagKurz(iso)}, ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${jahr}`;
}

/** `2026-10-04` → „Sonntag" – für die Unterzeile einer Terminzeile (UTC-Parsen wie überall hier). */
export function wochentagLang(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    timeZone: 'UTC',
  });
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
