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
import { getAgenda, getArrangement } from './ctRead.js';
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
): Promise<Response> {
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
  /**
   * **Die Antwort wird zurückgegeben, nicht verworfen** (#322, Schritt 10).
   *
   * Bis hierher hat kein Schreibvorgang etwas von ChurchTools zurückgebraucht. Beim Anlegen eines
   * Liedes ist das anders: Die Antwort enthält die **ID des neuen Datensatzes**, und ohne sie
   * müsste die App das eben angelegte Lied über seinen Namen wiedersuchen.
   *
   * Der Rumpf wird hier bewusst **nicht** gelesen – ein `res.json()` an dieser Stelle würde bei den
   * Antworten ohne Inhalt (204 beim Löschen) werfen und alle bisherigen Aufrufer treffen. Wer die
   * Antwort braucht, liest sie selbst (`neueId`); alle anderen ignorieren den Rückgabewert wie
   * bisher.
   */
  return res;
}

/**
 * Die ID des eben angelegten Datensatzes aus der Antwort – oder ein Fehler.
 *
 * **Warum das eine eigene Funktion mit Wurf ist:** Ein `201` bedeutet nicht, dass wir wissen, WAS
 * entstanden ist. Ohne ID kann die App das neue Lied weder öffnen noch ein Arrangement daranhängen –
 * sie stünde mit einem „hat geklappt" da, das ins Leere führt. Am 11.08.2026 hat genau diese Sorte
 * Annahme („success heißt, es ist etwas entstanden") zwei Notenblätter gekostet. Deshalb wird hier
 * nachgesehen, statt dem Statuscode zu glauben.
 *
 * Gemessen an der Test-Instanz (13.08.2026): `POST /api/songs` und `POST …/arrangements` antworten
 * beide `201` mit `{data: {id}}`.
 */
async function neueId(res: Response, was: string): Promise<number> {
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    throw new HttpError(502, `${was} wurde angelegt, aber ChurchTools nannte keine ID.`);
  }
  const id = (json as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new HttpError(502, `${was} wurde angelegt, aber ChurchTools nannte keine ID.`);
  }
  return id;
}

/** Eine hochzuladende Datei – Name, Art und Inhalt. Bytes für Binärdateien, Text für ChordPro. */
export interface HochzuladendeDatei {
  filename: string;
  /** MIME-Art, wie ChurchTools sie speichern soll (`text/plain`, `application/pdf`, …). */
  mime: string;
  inhalt: string | Uint8Array;
}

/**
 * Lädt EINE Datei an ein Arrangement hoch (#321).
 *
 * **Die einzige Stelle, die einen Datei-Upload zusammenbaut.** Vorher stand sie nur in
 * `uploadChordpro` und war dort auf ChordPro zugeschnitten (`text/plain` festverdrahtet). Für die
 * Dateiverwaltung braucht es beliebige Arten – und die Auflage aus #321 ist ausdrücklich, daraus
 * eine gemeinsame Funktion zu machen **statt einer zweiten Fassung daneben**. Genau diese
 * Fehlerklasse hat das Projekt am häufigsten getroffen; zuletzt am 11.08.2026 die Benennung einer
 * Anmerkungs-Ebene, die an drei Stellen stand.
 *
 * **ChurchTools ersetzt eine vorhandene Datei gleichen Namens NICHT** – sie liegt danach zweimal da.
 * Wer das nicht will, löscht die alte vorher; diese Funktion tut es nicht von sich aus, weil ein
 * ungefragtes Löschen fremder Dateien schlimmer wäre als ein Doppel.
 *
 * Kein Wiederholversuch: Ein Upload ist nicht idempotent (siehe `schreibe`).
 */
export async function uploadFile(
  cookie: string,
  arrangementId: number,
  datei: HochzuladendeDatei,
  meldungen: { verweigert: string; fehler: string } = {
    verweigert: 'Keine Berechtigung, Dateien in ChurchTools zu speichern.',
    fehler: 'Hochladen nach ChurchTools fehlgeschlagen',
  },
): Promise<void> {
  const form = new FormData();
  form.append('files[]', new Blob([datei.inhalt], { type: datei.mime }), datei.filename);
  await schreibe(cookie, `/api/files/song_arrangement/${arrangementId}`, {
    method: 'POST',
    form,
    verweigert: meldungen.verweigert,
    fehler: meldungen.fehler,
  });
}

/**
 * Lädt eine .chordpro-Datei an ein Arrangement hoch.
 *
 * Nur noch ein Aufrufer von `uploadFile` mit den ChordPro-Vorgaben. Die Meldungen bleiben wortgleich
 * wie vorher – beim Speichern einer Version sagt „Speichern" das Richtige, „Hochladen" wäre für den
 * Nutzer eine andere Handlung.
 */
export async function uploadChordpro(
  cookie: string,
  arrangementId: number,
  filename: string,
  text: string,
): Promise<void> {
  await uploadFile(
    cookie,
    arrangementId,
    { filename, mime: 'text/plain', inhalt: text },
    {
      verweigert: 'Keine Berechtigung, in ChurchTools zu speichern.',
      fehler: 'Speichern in ChurchTools fehlgeschlagen',
    },
  );
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

/** Die Stammdaten eines neuen Liedes. Kategorie und Name sind Pflicht (ChurchTools prüft es selbst). */
export interface NeuesLied {
  name: string;
  categoryId: number;
  author?: string;
  ccli?: string;
  copyright?: string;
}

/**
 * Legt ein Lied in ChurchTools an und liefert seine ID (#322, Schritt 10).
 *
 * **Autor, CCLI-Nummer und Copyright gehen mit** – gemessen an der Test-Instanz (13.08.2026) nimmt
 * `POST /api/songs` sie direkt an. Damit sind die Stammdaten EIN Schreibvorgang statt zwei; jeder
 * weitere wäre ein zusätzlicher Zwischenzustand, den die App erklären müsste, wenn er scheitert.
 *
 * **`note` fehlt hier mit Absicht:** Dasselbe Feld wird beim Anlegen von ChurchTools ignoriert (leer
 * in der Antwort, obwohl gesendet). Es über ein nachgeschobenes `PUT` zu setzen, hieße einen zweiten
 * Schreibvorgang für ein Nebenfeld – die Notiz kommt deshalb über „Stammdaten ändern" (Schritt 11).
 *
 * **Kein Wiederholversuch** (siehe `schreibe`): Ein zweiter Durchlauf legte ein zweites Lied an.
 */
export async function createSong(cookie: string, daten: NeuesLied): Promise<number> {
  const body: Record<string, unknown> = { name: daten.name, categoryId: daten.categoryId };
  // Leere Felder gar nicht erst senden: ChurchTools soll seine Vorgaben behalten, statt sie mit "" zu
  // überschreiben.
  if (daten.author?.trim()) body.author = daten.author.trim();
  if (daten.ccli?.trim()) body.ccli = daten.ccli.trim();
  if (daten.copyright?.trim()) body.copyright = daten.copyright.trim();

  const res = await schreibe(cookie, '/api/songs', {
    method: 'POST',
    json: body,
    verweigert: 'Keine Berechtigung, in dieser Kategorie Lieder anzulegen.',
    fehler: 'Lied anlegen fehlgeschlagen',
  });
  return neueId(res, 'Das Lied');
}

/**
 * Legt ein Arrangement an einem Lied an und liefert seine ID (#322, Schritt 10).
 *
 * **`isDefault` MUSS mitgeschickt werden.** Ohne das Flag antwortet ChurchTools mit
 * `isDefault: false` – das Lied hätte dann gar kein Standard-Arrangement (gemessen; beim ersten
 * Versuch genau so passiert). `getSongLibrary` fängt das über `?? arrangements[0]` ab, aber jede
 * Stelle, die sich auf `isDefault` verlässt, stünde vor `undefined`.
 *
 * Die Tonart geht direkt mit (`key`), damit das erste Arrangement nicht ohne dasteht.
 */
export async function createArrangement(
  cookie: string,
  songId: number,
  daten: { name: string; key?: string | null; isDefault?: boolean },
): Promise<number> {
  const body: Record<string, unknown> = {
    name: daten.name,
    isDefault: daten.isDefault ?? true,
  };
  if (daten.key?.trim()) body.key = daten.key.trim();

  const res = await schreibe(cookie, `/api/songs/${songId}/arrangements`, {
    method: 'POST',
    json: body,
    verweigert: 'Keine Berechtigung, Arrangements in ChurchTools anzulegen.',
    fehler: 'Arrangement anlegen fehlgeschlagen',
  });
  return neueId(res, 'Das Arrangement');
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
  // Frische Live-Daten – NIE aus einem Cache: geschrieben wird auf diesem Stand.
  const { arrangement: arr } = await getArrangement(cookie, songId, arrangementId);

  await schreibe(cookie, `/api/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'PUT',
    json: arrangementWritePayload(arr, { tempo }),
    verweigert: 'Keine Berechtigung, das Tempo in ChurchTools zu ändern.',
    fehler: 'Tempo speichern fehlgeschlagen',
  });
}
