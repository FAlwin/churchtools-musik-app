/**
 * Die lesenden ChurchTools-Endpunkte: Termine, Abläufe, Lieder (#280).
 *
 * Hier liegt auch das **Untertitel-Memo** (#306). Das ist kein Detail: Der Untertitel war die HÄLFTE
 * der Dauerlast der Terminliste – je Termin ein eigener Abruf, im Minutentakt, pro Gerät. Zehn
 * Minuten Vorhaltezeit halbieren sie. Ein Fehler wird bewusst NICHT gemerkt, sonst hielte ein
 * einzelner Aussetzer zehn Minuten.
 */
import { ctGet } from './ctHttp.js';
import type { CtAgendaItem, CtEvent, CtService, CtSong, CtSongListEntry } from './ctTypes.js';
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
