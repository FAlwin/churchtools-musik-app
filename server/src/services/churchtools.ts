/**
 * ChurchTools-API-Client. Kapselt Login und die lesenden Endpunkte.
 * Geschäftslogik (HTTP-unabhängig), wird von den Controllern genutzt.
 *
 * Authentifizierung läuft über das ChurchTools-Session-Cookie: beim Login holen
 * wir es ab, danach wird es bei jeder Anfrage mitgeschickt (auch für den
 * Datei-Download über public/filedownload, der den Authorization-Header nicht akzeptiert).
 */
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';

const BASE = config.churchtoolsBaseUrl.replace(/\/$/, '');

export interface ChurchToolsUser {
  id: number;
  firstName: string;
  lastName: string;
}

/** Liest aus den Set-Cookie-Headern das ChurchTools-Session-Cookie (name=value). */
function extractSessionCookie(res: Response): string | null {
  // Node 18+/undici: getSetCookie() liefert alle Set-Cookie-Header einzeln
  const cookies =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const c of cookies) {
    const match = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Meldet einen Nutzer bei ChurchTools an und gibt das Session-Cookie + Userinfo zurück.
 * Wirft HttpError(401) bei falschen Zugangsdaten.
 */
export async function login(
  username: string,
  password: string,
): Promise<{ cookie: string; user: ChurchToolsUser }> {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // ChurchTools antwortet bei falschen Zugangsdaten mit 400 (auch 401/403 möglich)
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'E-Mail oder Passwort falsch.');
  }
  if (!res.ok) {
    throw new HttpError(502, 'ChurchTools-Anmeldung fehlgeschlagen.');
  }

  const cookie = extractSessionCookie(res);
  if (!cookie) {
    throw new HttpError(502, 'Keine Session von ChurchTools erhalten.');
  }

  const user = await whoami(cookie);
  return { cookie, user };
}

/** Führt eine authentifizierte JSON-Anfrage gegen die ChurchTools-API aus. */
async function ctGet<T = unknown>(cookie: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
  }
  if (!res.ok) {
    throw new HttpError(502, `ChurchTools-Fehler (${res.status}) bei ${path}`);
  }
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}

export async function whoami(cookie: string): Promise<ChurchToolsUser> {
  const me = await ctGet<ChurchToolsUser>(cookie, '/api/whoami');
  return { id: me.id, firstName: me.firstName, lastName: me.lastName };
}

// ── Rohdaten-Typen (Ausschnitt der ChurchTools-Antworten) ──
export interface CtEvent {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  calendar?: { title?: string };
}

export interface CtAgendaSong {
  songId: number;
  arrangementId: number;
  title: string;
  arrangement: string;
  key: string | null;
  bpm: number | null;
}

export interface CtAgendaItem {
  id: number;
  title: string;
  type?: string;
  song?: CtAgendaSong;
}

export interface CtArrangementFile {
  name: string;
  fileUrl: string;
}

export interface CtArrangement {
  id: number;
  name: string;
  key: string | null;
  keyOfArrangement: string | null;
  bpm: number | null;
  beat: string | null;
  files: CtArrangementFile[];
}

export interface CtSong {
  id: number;
  name: string;
  author: string | null;
  ccli: string | null;
  arrangements: CtArrangement[];
}

export function getEvents(cookie: string, from: string, to: string): Promise<CtEvent[]> {
  return ctGet<CtEvent[]>(cookie, `/api/events?from=${from}&to=${to}`);
}

export function getAgenda(cookie: string, eventId: number): Promise<{ items: CtAgendaItem[] }> {
  return ctGet<{ items: CtAgendaItem[] }>(cookie, `/api/events/${eventId}/agenda`);
}

export function getSong(cookie: string, songId: number): Promise<CtSong> {
  return ctGet<CtSong>(cookie, `/api/songs/${songId}`);
}

/** Lädt eine Arrangement-Datei (z.B. .chordpro) als Text – mit Session-Cookie. */
export async function downloadFileText(cookie: string, fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl, { headers: { Cookie: cookie } });
  if (!res.ok) {
    throw new HttpError(502, `Datei-Download fehlgeschlagen (${res.status}).`);
  }
  return res.text();
}
