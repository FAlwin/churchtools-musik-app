/**
 * Die lesenden ChurchTools-Endpunkte: Termine, Abläufe, Lieder (#280).
 *
 * Hier liegt auch das **Untertitel-Memo** (#306). Das ist kein Detail: Der Untertitel war die HÄLFTE
 * der Dauerlast der Terminliste – je Termin ein eigener Abruf, im Minutentakt, pro Gerät. Zehn
 * Minuten Vorhaltezeit halbieren sie. Ein Fehler wird bewusst NICHT gemerkt, sonst hielte ein
 * einzelner Aussetzer zehn Minuten.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { ctGet } from './ctHttp.js';
import type {
  CtAbsence,
  CtAgendaItem,
  CtArrangement,
  CtEvent,
  CtService,
  CtSong,
  CtSongListEntry,
} from './ctTypes.js';
import { createTtlMemo } from './ttlMemo.js';

export function getEvents(cookie: string, from: string, to: string): Promise<CtEvent[]> {
  return ctGet<CtEvent[]>(cookie, `/api/events?from=${from}&to=${to}`);
}

/**
 * Untertitel-Memo (#306) – halbiert die Kosten der Terminliste.
 *
 * `getServicesWithSetlists` holt je Termin **zwei** Dinge: den Ablauf UND diesen Untertitel. Bei
 * ~8 Terminen im Fenster sind das 1 + 2×8 = 17 ChurchTools-Anfragen – **alle 60 Sekunden, pro Gerät**.
 * Bei fünf Geräten im Gottesdienst läppert sich das zur größten Dauerlast der App.
 *
 * Ein Termin-Untertitel („Kennenlernabend") ändert sich praktisch nie. Zehn Minuten Vorhaltezeit sind
 * deshalb unkritisch und sparen die Hälfte der Anfragen.
 *
 * **Schlüssel kontobezogen** (#199): Vorher teilten sich alle Konten den Ablauf-Fingerabdruck, und wer
 * keinen Zugriff hatte, bekam den Wert eines Berechtigten. Derselbe Fehler wäre hier möglich –
 * Kalender-Sichtbarkeiten unterscheiden sich je Konto. Die Kennung kommt aus `accountKey`.
 */
const SUBTITLE_TTL_MS = 10 * 60_000;

const subtitleMemo = createTtlMemo<string | null>(SUBTITLE_TTL_MS);

/** Nur für Tests: Untertitel-Memo leeren. */
export function __clearSubtitleMemo(): void {
  subtitleMemo.clear();
}

/** Liest den Untertitel eines Kalender-Termins (z.B. „Kennenlernabend"); null bei Fehler. */
export async function getAppointmentSubtitle(
  cookie: string,
  calendarId: string,
  appointmentId: number,
  /** Konto-Kennung aus `accountKey` – trennt die Sichtbarkeiten (#199). */
  account: string,
): Promise<string | null> {
  const key = `${account}|${calendarId}|${appointmentId}`;
  const hit = subtitleMemo.get(key);
  // `undefined` = nicht gemerkt. Ein gemerktes `null` („kein Untertitel") ist ein gültiger Treffer –
  // und der häufigste. Würde er als Fehltreffer gelten, spart das Memo praktisch nichts.
  if (hit !== undefined) return hit;

  let subtitle: string | null = null;
  try {
    const data = await ctGet<{ appointment?: { subtitle?: string }; subtitle?: string }>(
      cookie,
      `/api/calendars/${calendarId}/appointments/${appointmentId}`,
    );
    const roh = data.appointment?.subtitle ?? data.subtitle ?? null;
    subtitle = roh && roh.trim() ? roh.trim() : null;
  } catch {
    // Ein Fehler wird NICHT gemerkt (#306): Sonst hielte ein einzelner Aussetzer den Untertitel zehn
    // Minuten lang fälschlich auf „keiner" – „vorübergehend ist nicht ungültig".
    return null;
  }
  subtitleMemo.set(key, subtitle);
  return subtitle;
}

export function getAgenda(cookie: string, eventId: number): Promise<{ items: CtAgendaItem[] }> {
  return ctGet<{ items: CtAgendaItem[] }>(cookie, `/api/events/${eventId}/agenda`);
}

export function getSong(cookie: string, songId: number): Promise<CtSong> {
  return ctGet<CtSong>(cookie, `/api/songs/${songId}`);
}

/**
 * Ein bestimmtes Arrangement eines Lieds – frisch geladen, oder 404 (#321).
 *
 * **Warum als eigene Funktion:** Dieselben vier Zeilen standen an zwei Stellen, samt **wortgleicher**
 * Fehlermeldung – in `updateArrangementTempo` (`ctWrite`) und in `loadArrangementVersions`
 * (`setlistBuilder`). Mit der Dateiverwaltung wäre eine dritte dazugekommen. Sie liegt hier in
 * `ctRead`, weil beide Module von hier lesen dürfen, ohne einen Ring zu bilden.
 *
 * Das Lied kommt mit zurück: Wer das Arrangement sucht, braucht oft auch den Liednamen (die
 * Versionsdateien tragen ihn), und ein zweiter Abruf für dieselben Daten wäre eine Anfrage zu viel
 * gegen ChurchTools (#300).
 *
 * **Nie aus einem Cache.** Geschrieben wird auf dem, was hier zurückkommt – ein veralteter Stand
 * würde Felder mit alten Werten überschreiben.
 */
export async function getArrangement(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<{ song: CtSong; arrangement: CtArrangement }> {
  const song = await getSong(cookie, songId);
  const arrangement = song.arrangements.find((a) => a.id === arrangementId);
  if (!arrangement) throw new HttpError(404, 'Arrangement nicht gefunden.');
  return { song, arrangement };
}

/** Lädt die ChurchTools-Dienste (z.B. „Musik", „Predigt") für die Verantwortlich-Chips. */
export async function getCtServices(cookie: string): Promise<CtService[]> {
  const data = await ctGet<CtService[]>(cookie, `/api/services`);
  return [...data].sort(
    (a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || a.name.localeCompare(b.name, 'de'),
  );
}

/** Lädt alle Songs (paginiert) für die „Alle Lieder"-Ansicht. */
export async function getAllSongs(cookie: string): Promise<CtSongListEntry[]> {
  const all: CtSongListEntry[] = [];
  for (let page = 1; page <= 50; page++) {
    const data = await ctGet<CtSongListEntry[]>(cookie, `/api/songs?limit=100&page=${page}`);
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

/**
 * Abwesenheiten einer Person im Zeitfenster (#177). Parameter `from`/`to`/`limit` wie der alte
 * Planner sie gemessen hat (`churchtools_client.get_absences`). Die App fragt nur das **eigene**
 * Konto ab – die Personen-ID kommt aus der Sitzung, nie aus dem Request.
 */
export function getAbsences(
  cookie: string,
  personId: number,
  from: string,
  to: string,
): Promise<CtAbsence[]> {
  const q = new URLSearchParams({ from, to, limit: '500' });
  return ctGet<CtAbsence[]>(cookie, `/api/persons/${personId}/absences?${q.toString()}`);
}
