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

/**
 * **Der Grund einer Abwesenheit, lesbar.**
 *
 * ChurchTools liefert bei den Standardgründen keinen Text, sondern einen Übersetzungsschlüssel –
 * gemessen am 05.09.2026 an der ECG-Instanz: `absent.reason.absence`, `absent.reason.vacation`,
 * `absent.reason.sick`. Einen Endpunkt, der die Gründe mit deutschen Namen ausgibt, hat die API
 * nicht (beide naheliegenden Pfade antworten 404).
 *
 * Selbst angelegte Gründe tragen dagegen einen echten Namen – der wird unverändert durchgereicht.
 * Ein unbekannter Schlüssel wird lesbar gemacht, statt ihn rohe Technik zu zeigen.
 */
const GRUND_TEXTE: Record<string, string> = {
  'absent.reason.absence': 'Abwesend',
  'absent.reason.vacation': 'Urlaub',
  'absent.reason.sick': 'Krank',
};

export function grundLesbar(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  const bekannt = GRUND_TEXTE[n];
  if (bekannt) return bekannt;
  if (!n.startsWith('absent.reason.')) return n; // eigener Grund der Gemeinde
  const rest = n
    .slice('absent.reason.'.length)
    .replace(/[._-]+/g, ' ')
    .trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}
