/**
 * Die schreibenden ChurchTools-Operationen (#280).
 *
 * Alles hier ändert Daten in ChurchTools. Zwei Regeln gelten durchgehend:
 *  - **Jeder Schreibvorgang holt zuerst ein CSRF-Token** und meldet eine Ablehnung über
 *    `csrfWriteDenied` – die eine Stelle, die den Fehler meldet UND das Token verwirft. Wäre das je
 *    Funktion einzeln eingebaut, hätte genau eine davon gefehlt (#298).
 *  - **Kein Schreibvorgang wird automatisch wiederholt.** Nicht alle sind idempotent.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { agendaItemWritePayload } from './agendaPayload.js';
import { arrangementWritePayload } from './arrangementPayload.js';
import { csrfWriteDenied, getCsrfToken } from './ctCsrf.js';
import { BASE, CT_FILE_TIMEOUT_MS, ctSignal } from './ctHttp.js';
import { getAgenda, getSong } from './ctRead.js';
import type { CtAgendaItem } from './ctTypes.js';

/** Fehlermeldung, wenn ChurchTools das Ändern des Ablaufs verweigert – siebenmal derselbe Satz. */
const ABLAUF_VERWEIGERT = 'Keine Berechtigung, den Ablauf in ChurchTools zu ändern.';

/**
 * Der Schreibvorgang selbst – **einmal, für alle sieben** (#280).
 *
 * Jede Schreibfunktion hatte dieses Ritual vorher wortgleich stehen: Token holen, als `CSRF-Token`
 * mitschicken, bei 401/403 über `csrfWriteDenied` melden (das den Fehler wirft UND das Token
 * verwirft), sonst 502. Sieben Kopien einer Regel – und der Kommentar an `csrfWriteDenied` sagte
 * bereits, warum das gefährlich ist: „Wäre die Invalidierung an den Stellen einzeln eingebaut, hätte
 * genau eine davon gefehlt."
 *
 * Jetzt kann sie niemand mehr vergessen: Wer eine achte Schreiboperation ergänzt, bekommt Token,
 * Kopfzeile und Ablehnungs-Behandlung, ohne daran zu denken.
 *
 * Bewusst NICHT hier: ein Wiederholversuch. Schreibvorgänge sind nicht alle idempotent – ein
 * Datei-Upload liefe doppelt. Wiederholt wird nur das Token-Holen (#294), und das steckt in
 * `getCsrfToken`.
 */
async function schreibe(
  cookie: string,
  pfad: string,
  opts: {
    method: 'POST' | 'PUT' | 'DELETE';
    /** JSON-Rumpf; schließt `form` aus. */
    json?: unknown;
    /** Datei-Upload; schließt `json` aus und bekommt die längere Zeitgrenze. */
    form?: FormData;
    /** Meldung bei 401/403. */
    verweigert: string;
    /** Meldung bei jedem anderen Fehlschlag – erhält den Statuscode angehängt. */
    fehler: string;
    /** Für Löschvorgänge: „schon weg" ist kein Fehler. */
    okBei404?: boolean;
  },
): Promise<void> {
  const csrf = await getCsrfToken(cookie);
  const headers: Record<string, string> = { Cookie: cookie, 'CSRF-Token': csrf };
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${pfad}`, {
    // Datei-Uploads dürfen länger dauern als ein API-Aufruf.
    signal: ctSignal(opts.form ? CT_FILE_TIMEOUT_MS : undefined),
    method: opts.method,
    headers,
    body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
  });

  if (res.status === 401 || res.status === 403) csrfWriteDenied(cookie, opts.verweigert);
  if (!res.ok && !(opts.okBei404 && res.status === 404)) {
    throw new HttpError(502, `${opts.fehler} (${res.status}).`);
  }
}

/** Lädt eine .chordpro-Datei an ein Arrangement hoch (ersetzt vorhandene gleichen Namens nicht automatisch). */
export async function uploadChordpro(
  cookie: string,
  arrangementId: number,
  filename: string,
  text: string,
): Promise<void> {
  const form = new FormData();
  form.append('files[]', new Blob([text], { type: 'text/plain' }), filename);
  await schreibe(cookie, `/api/files/song_arrangement/${arrangementId}`, {
    method: 'POST',
    form,
    verweigert: 'Keine Berechtigung, in ChurchTools zu speichern.',
    fehler: 'Speichern in ChurchTools fehlgeschlagen',
  });
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

  await schreibe(cookie, `/api/events/${eventId}/agenda`, {
    method: 'PUT',
    json: { items: payload },
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablauf-Reihenfolge speichern fehlgeschlagen',
  });
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
  const body: Record<string, unknown> = { type: data.type, title: data.title };
  // Lied-Verknüpfung MUSS als top-level arrangementId gesendet werden (siehe reorderAgenda).
  if (data.type === 'song' && data.arrangementId) body.arrangementId = data.arrangementId;
  if (data.responsible) body.responsible = data.responsible;
  if (data.note) body.note = data.note;
  // CT erwartet die Dauer in Sekunden (Feld `duration`), die UI arbeitet in Minuten.
  if (data.durationMin !== undefined) body.duration = data.durationMin * 60;
  await schreibe(cookie, `/api/events/${eventId}/agenda/items`, {
    method: 'POST',
    json: body,
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt anlegen fehlgeschlagen',
  });
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
  await schreibe(cookie, `/api/events/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    json: body,
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt ändern fehlgeschlagen',
  });
}

/** Löscht einen Ablaufpunkt aus der Agenda eines Events. */
export async function deleteAgendaItem(
  cookie: string,
  eventId: number,
  itemId: number,
): Promise<void> {
  await schreibe(cookie, `/api/events/${eventId}/agenda/items/${itemId}`, {
    method: 'DELETE',
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Ablaufpunkt löschen fehlgeschlagen',
    okBei404: true, // schon weg ist auch weg
  });
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
  const action = hidden ? 'hide' : 'unhide';
  await schreibe(cookie, `/api/events/${eventId}/agenda/items/${itemId}/${action}`, {
    method: 'POST',
    verweigert: ABLAUF_VERWEIGERT,
    fehler: 'Uhrzeit aus-/einblenden fehlgeschlagen',
  });
}

/** Löscht eine Datei in ChurchTools (per Datei-ID). */
export async function deleteFile(cookie: string, fileId: number): Promise<void> {
  await schreibe(cookie, `/api/files/${fileId}`, {
    method: 'DELETE',
    verweigert: 'Keine Berechtigung zum Löschen in ChurchTools.',
    fehler: 'Löschen in ChurchTools fehlgeschlagen',
    okBei404: true, // schon weg ist auch weg
  });
}

/**
 * Setzt das Tempo eines Arrangements in ChurchTools.
 *
 * **Lesen–ändern–schreiben, und das ist keine Stilfrage:** `PUT` auf ein Arrangement ersetzt den
 * ganzen Datensatz – alles Nicht-Gesendete wird `null`. An der Test-Instanz gemessen löschte ein
 * `PUT { name, bpm }` in einem Zug Tonart, zweite Tonart und Dauer. Deshalb wird das Arrangement
 * zuerst frisch gelesen und der Payload daraus gebaut (`arrangementWritePayload`).
 *
 * Geschrieben wird `tempo` (Zahl); das gelesene `bpm` ist abgeleitet und nicht beschreibbar.
 *
 * **Rechte:** wie bei den ChordPro-Versionen – das Cookie des Nutzers geht durch, ChurchTools
 * entscheidet. Ein 401/403 wird über `csrfWriteDenied` gemeldet (und verwirft das Token, #298).
 */
export async function updateArrangementTempo(
  cookie: string,
  songId: number,
  arrangementId: number,
  tempo: number,
): Promise<void> {
  const song = await getSong(cookie, songId); // frische Live-Daten – NIE aus einem Cache
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');

  await schreibe(cookie, `/api/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'PUT',
    json: arrangementWritePayload(arr, { tempo }),
    verweigert: 'Keine Berechtigung, das Tempo in ChurchTools zu ändern.',
    fehler: 'Tempo speichern fehlgeschlagen',
  });
}
