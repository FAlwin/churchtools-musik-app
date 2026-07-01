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
export function extractSessionCookie(res: Response): string | null {
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

// Cookie → ChurchTools-Person-ID, gecacht mit 12-h-Auffrischung – spart whoami-Abrufe je Anmerkung
// und prüft periodisch, ob das Cookie noch gilt (unabhängig von der App-Cookie-Lebensdauer).
const userIdCache = new Map<string, { id: number; at: number }>();

/** Liefert die ChurchTools-Person-ID zum Session-Cookie (gecacht). */
export async function getUserId(cookie: string): Promise<number> {
  const c = userIdCache.get(cookie);
  if (c && Date.now() - c.at < 12 * 3_600_000) return c.id;
  const me = await whoami(cookie);
  userIdCache.set(cookie, { id: me.id, at: Date.now() });
  return me.id;
}

export interface UserCapabilities {
  canViewSongs: boolean;
  canViewAgendas: boolean;
  canEditAgendas: boolean;
  canEditSongs: boolean;
  isAdmin: boolean;
}

/** Ermittelt aus den ChurchTools-Rechten (Modul churchservice), was der Nutzer darf. */
export async function getCapabilities(cookie: string): Promise<UserCapabilities> {
  const data = await ctGet<Record<string, Record<string, unknown>>>(
    cookie,
    '/api/permissions/global',
  );
  const cs = data?.churchservice ?? {};
  const has = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  // Admin-Recht aus der Konfiguration (Form `modul:recht`).
  const [adminModule, adminPerm] = config.adminPermission.split(':');
  const isAdmin = has(data?.[adminModule]?.[adminPerm]);
  return {
    canViewSongs: has(cs['view songcategory']),
    canViewAgendas: has(cs['view agenda']),
    canEditAgendas: has(cs['edit agenda']),
    canEditSongs: has(cs['edit songcategory']),
    isAdmin,
  };
}

// ── Rohdaten-Typen (Ausschnitt der ChurchTools-Antworten) ──
export interface CtEvent {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  /** ID des zugehörigen Kalender-Termins (für den Untertitel) */
  appointmentId?: number;
  calendar?: { title?: string; domainIdentifier?: string };
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
  note?: string;
  /** Dauer des Punkts in Sekunden (CT-Rohwert). */
  duration?: number;
  /** Von ChurchTools berechnete absolute Startzeit (ISO-8601, UTC) – null wenn keine. */
  start?: string | null;
  /**
   * Startzeit je Event-ID. MASSGEBLICH für „Uhrzeit ausgeblendet": ist `startTimes[eventId]`
   * `null`, hat der Nutzer die Uhrzeit dieses Punkts in ChurchTools ausgeblendet (durchgestrichenes
   * Auge) – das Feld `start` bleibt davon unberührt und ist daher NICHT verlässlich.
   */
  startTimes?: Record<string, string | null>;
  isBeforeEvent?: boolean;
  /** Beim Lesen ein Objekt; beim Schreiben wird nur `text` als String gesendet. */
  responsible?: { text?: string; persons?: { service?: string; person?: { title?: string } }[] };
  position?: number;
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
  isDefault?: boolean;
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

/** Liest den Untertitel eines Kalender-Termins (z.B. „Kennenlernabend"); null bei Fehler. */
export async function getAppointmentSubtitle(
  cookie: string,
  calendarId: string,
  appointmentId: number,
): Promise<string | null> {
  try {
    const data = await ctGet<{ appointment?: { subtitle?: string }; subtitle?: string }>(
      cookie,
      `/api/calendars/${calendarId}/appointments/${appointmentId}`,
    );
    const subtitle = data.appointment?.subtitle ?? data.subtitle ?? null;
    return subtitle && subtitle.trim() ? subtitle.trim() : null;
  } catch {
    return null;
  }
}

export function getAgenda(cookie: string, eventId: number): Promise<{ items: CtAgendaItem[] }> {
  return ctGet<{ items: CtAgendaItem[] }>(cookie, `/api/events/${eventId}/agenda`);
}

export function getSong(cookie: string, songId: number): Promise<CtSong> {
  return ctGet<CtSong>(cookie, `/api/songs/${songId}`);
}

export interface CtService {
  id: number;
  name: string;
  sortKey?: number;
}

/** Lädt die ChurchTools-Dienste (z.B. „Musik", „Predigt") für die Verantwortlich-Chips. */
export async function getCtServices(cookie: string): Promise<CtService[]> {
  const data = await ctGet<CtService[]>(cookie, `/api/services`);
  return [...data].sort(
    (a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || a.name.localeCompare(b.name, 'de'),
  );
}

/** Lädt eine Arrangement-Datei (z.B. .chordpro) als Text – mit Session-Cookie. */
export async function downloadFileText(cookie: string, fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl, { headers: { Cookie: cookie } });
  if (!res.ok) {
    throw new HttpError(502, `Datei-Download fehlgeschlagen (${res.status}).`);
  }
  return res.text();
}

/** Extrahiert die Datei-ID aus einer ChurchTools-fileUrl (…&id=213&…). */
export function fileIdFromUrl(fileUrl: string): number | null {
  const m = fileUrl.match(/[?&]id=(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Lädt eine Datei als Bytes + Content-Type (zum Durchreichen an den Client). */
export async function fetchFileBytes(
  cookie: string,
  fileUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(fileUrl, { headers: { Cookie: cookie } });
  if (!res.ok) throw new HttpError(502, `Datei-Download fehlgeschlagen (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
}

/** Holt ein CSRF-Token (für schreibende Anfragen mit Cookie-Session nötig). */
async function getCsrfToken(cookie: string): Promise<string> {
  const res = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  if (!res.ok) throw new HttpError(502, 'CSRF-Token konnte nicht geholt werden.');
  const json = (await res.json()) as { data?: string };
  return json.data ?? '';
}

/** Lädt eine .chordpro-Datei an ein Arrangement hoch (ersetzt vorhandene gleichen Namens nicht automatisch). */
export async function uploadChordpro(
  cookie: string,
  arrangementId: number,
  filename: string,
  text: string,
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const form = new FormData();
  form.append('files[]', new Blob([text], { type: 'text/plain' }), filename);
  const res = await fetch(`${BASE}/api/files/song_arrangement/${arrangementId}`, {
    method: 'POST',
    headers: { Cookie: cookie, 'CSRF-Token': csrf },
    body: form,
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, in ChurchTools zu speichern.');
  }
  if (!res.ok) {
    throw new HttpError(502, `Speichern in ChurchTools fehlgeschlagen (${res.status}).`);
  }
}

/**
 * Baut den Schreib-Payload eines Ablaufpunkts aus den Live-Daten. Wichtig:
 *  - `responsible` als Text (Personen-Zuordnungen bleiben in ChurchTools erhalten),
 *  - Lied-Verknüpfung als **top-level `arrangementId`** – ein verschachteltes song-Objekt
 *    ignoriert ChurchTools und stuft den Punkt auf „text" herab!
 * `overrides` überschreibt einzelne Felder (z.B. title/note/position).
 */
function agendaItemWritePayload(
  it: CtAgendaItem,
  overrides: {
    title?: string;
    note?: string;
    position?: number;
    arrangementId?: number;
    unlink?: boolean;
    responsible?: string;
    /** Neue Dauer in Sekunden (CT-Einheit); überschreibt die bestehende. */
    durationSec?: number;
  } = {},
): Record<string, unknown> {
  // Lied-Verknüpfung: ein übergebenes arrangementId hebt den Punkt auf type 'song' an
  // (verifiziert: PUT mit type 'song' + top-level arrangementId wandelt einen text-Punkt
  // sauber um, ohne Herabstufung); sonst bleibt eine vorhandene Verknüpfung erhalten.
  // unlink=true löst die Verknüpfung wieder (verifiziert: type 'text' ohne arrangementId).
  const arrangementId = overrides.unlink
    ? undefined
    : (overrides.arrangementId ?? it.song?.arrangementId);
  const isSong = !overrides.unlink && (overrides.arrangementId !== undefined || !!it.song);
  return {
    title: overrides.title ?? it.title,
    type: isSong ? 'song' : overrides.unlink ? 'text' : it.type,
    note: overrides.note ?? it.note ?? '',
    duration: overrides.durationSec ?? it.duration ?? 0,
    isBeforeEvent: it.isBeforeEvent ?? false,
    // responsible ist ein Textfeld; ChurchTools löst Dienst-Tokens wie „[Musik]" selbst
    // zu den im Dienstplan zugewiesenen Personen auf.
    responsible: overrides.responsible ?? it.responsible?.text ?? '',
    ...(overrides.position !== undefined ? { position: overrides.position } : {}),
    ...(arrangementId ? { arrangementId } : {}),
  };
}

/**
 * Schreibt die Reihenfolge des Ablaufs zurück: lädt die aktuellen Punkte frisch,
 * sortiert sie nach `orderedItemIds` und speichert die ganze Liste per
 * `PUT /api/events/{id}/agenda` (Position = Listenindex).
 */
export async function reorderAgenda(
  cookie: string,
  eventId: number,
  orderedItemIds: number[],
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const { items } = await getAgenda(cookie, eventId); // frische Live-Daten
  const byId = new Map(items.map((i) => [i.id, i]));

  // Schutz: nur erlauben, wenn die übergebene Reihenfolge exakt dieselben Punkte enthält.
  const same = orderedItemIds.length === items.length && orderedItemIds.every((id) => byId.has(id));
  if (!same) {
    throw new HttpError(409, 'Der Ablauf hat sich geändert. Bitte neu laden und erneut versuchen.');
  }

  const payload = orderedItemIds.map((id, index) => ({
    id,
    ...agendaItemWritePayload(byId.get(id) as CtAgendaItem, { position: index }),
  }));

  const res = await fetch(`${BASE}/api/events/${eventId}/agenda`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'CSRF-Token': csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payload }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.');
  }
  if (!res.ok) {
    throw new HttpError(502, `Ablauf-Reihenfolge speichern fehlgeschlagen (${res.status}).`);
  }
}

/** Legt einen neuen Ablaufpunkt an (am Ende). Für Lieder ist `arrangementId` Pflicht. */
export async function createAgendaItem(
  cookie: string,
  eventId: number,
  data: {
    type: 'header' | 'text' | 'song';
    title: string;
    arrangementId?: number;
    responsible?: string;
    note?: string;
    /** Dauer in Minuten (UI-Einheit) – wird in CT-Sekunden umgerechnet. */
    durationMin?: number;
  },
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const body: Record<string, unknown> = { type: data.type, title: data.title };
  // Lied-Verknüpfung MUSS als top-level arrangementId gesendet werden (siehe reorderAgenda).
  if (data.type === 'song' && data.arrangementId) body.arrangementId = data.arrangementId;
  if (data.responsible) body.responsible = data.responsible;
  if (data.note) body.note = data.note;
  // CT erwartet die Dauer in Sekunden (Feld `duration`), die UI arbeitet in Minuten.
  if (data.durationMin !== undefined) body.duration = data.durationMin * 60;
  const res = await fetch(`${BASE}/api/events/${eventId}/agenda/items`, {
    method: 'POST',
    headers: { Cookie: cookie, 'CSRF-Token': csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.');
  }
  if (!res.ok) {
    throw new HttpError(502, `Ablaufpunkt anlegen fehlgeschlagen (${res.status}).`);
  }
}

export interface CtSongListEntry {
  id: number;
  name: string;
  author: string | null;
  arrangements: {
    id: number;
    name: string;
    key: string | null;
    keyOfArrangement: string | null;
    isDefault?: boolean;
    bpm?: number | null;
  }[];
}

/** Sucht Songs in ChurchTools (Name) und liefert sie mit ihren Arrangements zurück. */
export async function searchSongs(cookie: string, query: string): Promise<CtSongListEntry[]> {
  const q = encodeURIComponent(query);
  return ctGet<CtSongListEntry[]>(cookie, `/api/songs?query=${q}&limit=25`);
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
 * Ändert Felder eines Ablaufpunkts (z.B. Titel). Liest den Punkt frisch, überschreibt nur
 * die übergebenen Felder und sendet alle übrigen unverändert mit. Lied-Verknüpfung bleibt
 * über top-level `arrangementId` erhalten.
 */
export async function updateAgendaItem(
  cookie: string,
  eventId: number,
  itemId: number,
  fields: {
    title?: string;
    note?: string;
    arrangementId?: number;
    unlink?: boolean;
    responsible?: string;
    /** Neue Dauer in Minuten (UI-Einheit) – wird in CT-Sekunden umgerechnet. */
    durationMin?: number;
  },
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const { items } = await getAgenda(cookie, eventId);
  const it = items.find((i) => i.id === itemId);
  if (!it) throw new HttpError(404, 'Ablaufpunkt nicht gefunden.');

  const body = agendaItemWritePayload(it, {
    title: fields.title,
    note: fields.note,
    arrangementId: fields.arrangementId,
    unlink: fields.unlink,
    responsible: fields.responsible,
    durationSec: fields.durationMin !== undefined ? fields.durationMin * 60 : undefined,
  });
  const res = await fetch(`${BASE}/api/events/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'CSRF-Token': csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.');
  }
  if (!res.ok) {
    throw new HttpError(502, `Ablaufpunkt ändern fehlgeschlagen (${res.status}).`);
  }
}

/** Löscht einen Ablaufpunkt aus der Agenda eines Events. */
export async function deleteAgendaItem(
  cookie: string,
  eventId: number,
  itemId: number,
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const res = await fetch(`${BASE}/api/events/${eventId}/agenda/items/${itemId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, 'CSRF-Token': csrf },
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.');
  }
  if (!res.ok && res.status !== 404) {
    throw new HttpError(502, `Ablaufpunkt löschen fehlgeschlagen (${res.status}).`);
  }
}

/**
 * Blendet die Uhrzeit eines Ablaufpunkts aus (`hidden=true`) oder wieder ein (`false`) – das
 * durchgestrichene Auge in ChurchTools. Verifiziert: schaltet `startTimes[eventId]` zwischen
 * der Zeit und `null` um (HTTP 204). Pro Event gespeichert, leerer Body.
 */
export async function setAgendaItemHidden(
  cookie: string,
  eventId: number,
  itemId: number,
  hidden: boolean,
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const action = hidden ? 'hide' : 'unhide';
  const res = await fetch(`${BASE}/api/events/${eventId}/agenda/items/${itemId}/${action}`, {
    method: 'POST',
    headers: { Cookie: cookie, 'CSRF-Token': csrf },
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.');
  }
  if (!res.ok) {
    throw new HttpError(502, `Uhrzeit aus-/einblenden fehlgeschlagen (${res.status}).`);
  }
}

/** Löscht eine Datei in ChurchTools (per Datei-ID). */
export async function deleteFile(cookie: string, fileId: number): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const res = await fetch(`${BASE}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, 'CSRF-Token': csrf },
  });
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(403, 'Keine Berechtigung zum Löschen in ChurchTools.');
  }
  if (!res.ok && res.status !== 404) {
    throw new HttpError(502, `Löschen in ChurchTools fehlgeschlagen (${res.status}).`);
  }
}
