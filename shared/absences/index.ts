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

/* ------------------------------------------------------------- Termine und Zeitfenster (22.09.2026) */

/**
 * **Mehrere Termine an einem Tag – einzeln** (Alwin, 22.09.2026: „manchmal hab ich morgens keine
 * Zeit kann aber nachmittags und umgekehrt").
 *
 * Bis dahin trug ein Haken den ganzen **Tag** ein; zwei Termine am selben Tag hingen dadurch
 * zusammen. Jetzt schreibt ein Haken das **Zeitfenster des Termins**. ChurchTools kann das – an der
 * Test-Instanz gemessen (22.09.2026): Ein Eintrag mit `startTime`/`endTime` wird angenommen und
 * unverändert zurückgeliefert, ohne sie bleibt er ganztägig.
 *
 * Die beiden Funktionen hier stehen bewusst im geteilten Teil: Die App braucht sie für die Häkchen,
 * der Server für die Doppel-Erkennung. Zweimal geschrieben wären sie genau die Dopplung, die dieses
 * Projekt am teuersten zu stehen kam.
 */
export interface TerminZeit {
  /** ISO-Startzeitpunkt. */
  startDate: string;
  /** ISO-Endzeitpunkt; ohne bekanntes Ende gleich dem Start. */
  endDate: string;
  /** `YYYY-MM-DD` des Termintags. */
  date: string;
}

/**
 * Das Zeitfenster, das ein Haken an diesem Termin einträgt – oder `null` für „ganztägig".
 *
 * Ohne bekanntes Ende gibt es kein sinnvolles Fenster: Dann bleibt es beim ganzen Tag, wie vorher.
 * Lieber ein Eintrag, der zu viel abdeckt, als einer, der eine Minute lang gilt.
 */
export function zeitfensterFuer(ev: TerminZeit): { startTime: string; endTime: string } | null {
  if (!ev.endDate || ev.endDate <= ev.startDate) return null;
  return { startTime: ev.startDate, endTime: ev.endDate };
}

/** Deckt die Abwesenheit diesen Termin ab? Ganztägig deckt alles, sonst zählt die Überschneidung. */
export function decktTermin(
  a: { startDate: string; endDate: string; startTime: string | null; endTime: string | null },
  ev: TerminZeit,
): boolean {
  if (a.startDate > ev.date || ev.date > a.endDate) return false;
  // Ganztägig (Urlaub, alles von früher, alles über das Plus) gilt für jeden Termin des Tages.
  if (!a.startTime || !a.endTime) return true;
  // Grenzen offen behandeln, sonst deckte das Fenster eines Termins den unmittelbar folgenden mit
  // ab (10–12 Uhr und 12–14 Uhr sind zwei verschiedene Termine).
  if (ev.endDate <= ev.startDate) {
    return a.startTime <= ev.startDate && ev.startDate < a.endTime;
  }
  return a.startTime < ev.endDate && ev.startDate < a.endTime;
}
