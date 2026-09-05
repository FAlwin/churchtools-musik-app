/**
 * Abwesenheiten (#177) – die **Marker-Konvention**, einmal für App, Server und Sync-Dienst.
 *
 * Von uns erzeugte ChurchTools-Abwesenheiten tragen im Kommentar den Präfix `[Musikteam]`. Er ist
 * das Erkennungszeichen dafür, was die App anfassen darf: **Nur Marker-Einträge werden gelöscht oder
 * vom Sync überschrieben.** Manuelle Abwesenheiten (Urlaub, krank – ohne Marker) werden gelesen und
 * angezeigt, aber nie verändert. Steht die Regel nur hier, kann sie in Server und Sync nicht
 * auseinanderlaufen – die teuerste Fehlerklasse dieses Projekts.
 */
export const ABSENCE_MARKER = '[Musikteam]';

/** Kommentar für ChurchTools: Marker + optionaler Freitext (getrimmt). */
export function mitMarker(freitext?: string | null): string {
  const t = (freitext ?? '').trim();
  return t ? `${ABSENCE_MARKER} ${t}` : ABSENCE_MARKER;
}

/** Stammt der Eintrag von uns (App oder Sync)? Nur dann darf er angefasst werden. */
export function istMarkerEintrag(comment: string | null | undefined): boolean {
  return (comment ?? '').trimStart().startsWith(ABSENCE_MARKER);
}

/** Der Freitext ohne Marker – für die Anzeige. Ohne Marker bleibt der Kommentar, wie er ist. */
export function markerFreitext(comment: string | null | undefined): string {
  const c = (comment ?? '').trim();
  return c.startsWith(ABSENCE_MARKER) ? c.slice(ABSENCE_MARKER.length).trim() : c;
}
