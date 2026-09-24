/**
 * Verfügbarkeit / Abwesenheiten (#177) – der generische Kern.
 *
 * Musiker pflegen ihre **eigenen** Abwesenheiten in ChurchTools, mit dem eigenen Login. Drei Regeln,
 * alle an dieser einen Stelle:
 *  - **Nur das eigene Konto.** Die Personen-ID kommt aus der Sitzung (`userId`), nie aus dem Request.
 *    ChurchTools ließe bei der ECG auch fremde Einträge zu (Nebenbefund 16.07.2026) – die App nicht.
 *  - **Jeder eigene Eintrag darf geändert und gelöscht werden** – auch ein manuell in ChurchTools
 *    eingetragener Urlaub (Marker-Sperre aufgehoben 05.09.2026, siehe `eigenerEintrag`). Der Marker
 *    (`@shared/absences`) bleibt Herkunftskennzeichen für den Excel-Sync und die Rückfrage.
 *  - **Kein Doppel.** Denselben Zeitraum ein zweites Mal einzutragen legt keinen zweiten Eintrag an.
 *
 * Kein Excel hier – der Sync ist ein eigener Dienst (`excel-sync/`), siehe Plan §12.
 */
import type { Absence, AbsenceEvent, AbsenceReason, NeueAbsence } from '@shared/types/index';
import { grundLesbar, istMarkerEintrag, markerFreitext, mitMarker } from '@shared/absences/index';
import { ctId } from '../utils/ctId.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isoTag, tagAusIso } from '../utils/isoTag.js';
import { ctAjax } from './ctAjax.js';
import { getAbsences, getEvents } from './ctRead.js';
import { gruendeMemo } from './ctSessionMemos.js';
import type { CtAbsence, CtEvent } from './ctTypes.js';
import { createAbsence, deleteAbsence } from './ctWrite.js';

/** `YYYY-MM-DD` – die eine Regex fürs Datumsformat; der Controller nutzt dieselbe (Dopplungs-Suche 18.09.2026). */
export const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Längster Zeitraum, den die App eintragen lässt – ein Jahr; alles darüber ist ein Tippfehler. */
export const MAX_TAGE = 366;

/** ChurchTools-Datensatz → App-Sicht. Reine Funktion, testbar ohne Netz. */
export function zuAbsence(a: CtAbsence): Absence {
  return {
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate,
    // Zeitfenster (22.09.2026): null heißt ganztägig – so liefert ChurchTools es auch.
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    comment: markerFreitext(a.comment),
    reason: grundLesbar(a.absenceReason?.name),
    reasonId: ctId(a.absenceReason?.id),
    vonApp: istMarkerEintrag(a.comment),
  };
}

/** Anzahl Tage zwischen zwei ISO-Tagen (einschließlich beider). */
export function tageInklusive(start: string, ende: string): number {
  const ms = Date.parse(`${ende}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Prüft den Wunsch und baut den ChurchTools-Rumpf. Wirft 400 mit einem Satz, den man dem Nutzer
 * zeigen kann – die Zod-Prüfung im Controller kennt nur die Form, nicht den Sinn.
 */
export function absenceBody(
  neu: NeueAbsence,
  herkunft: { reasonId?: number | null; mitMarker?: boolean } = {},
): {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  absenceReasonId: number;
  comment: string;
} {
  if (!ISO_TAG.test(neu.startDate) || !ISO_TAG.test(neu.endDate)) {
    throw new HttpError(400, 'Bitte ein gültiges Datum wählen.');
  }
  if (neu.endDate < neu.startDate) {
    throw new HttpError(400, 'Das Ende liegt vor dem Anfang.');
  }
  if (tageInklusive(neu.startDate, neu.endDate) > MAX_TAGE) {
    throw new HttpError(400, 'Ein Zeitraum darf höchstens ein Jahr lang sein.');
  }
  // Zeitfenster: beide oder keins. Ein halbes Fenster wäre ein Eintrag, der in ChurchTools anders
  // aussieht als gemeint – lieber früh und mit einem verständlichen Satz ablehnen.
  if (Boolean(neu.startTime) !== Boolean(neu.endTime)) {
    throw new HttpError(400, 'Zu einer Uhrzeit gehören Anfang und Ende.');
  }
  if (neu.startTime && neu.endTime && Date.parse(neu.endTime) <= Date.parse(neu.startTime)) {
    throw new HttpError(400, 'Das Ende liegt vor dem Anfang.');
  }
  // Das Fenster muss zu den Tagen passen – sonst entstünde ein Eintrag, der in ChurchTools etwas
  // anderes behauptet, als er meint (Code-Check 23.09.2026). Verglichen wird der Tag IN DER GEMEINDE
  // (#414): Bis zum 24.09.2026 stand hier ein Textvergleich, und der hätte einen Termin um 0:30 Uhr
  // (`22:30Z` des Vortags) abgelehnt, sobald der Termin am richtigen Tag steht.
  const mitFenster = Boolean(neu.startTime && neu.endTime);
  if (neu.startTime && tagAusIso(neu.startTime) !== neu.startDate) {
    throw new HttpError(400, 'Die Uhrzeit gehört nicht zum gewählten Tag.');
  }
  return {
    startDate: neu.startDate,
    /**
     * **Mit Uhrzeit ist der Endtag der Tag des Endes** – so rechnet ChurchTools selbst (gemessen an
     * der Test-Instanz, 24.09.2026): Ein geschickter Endtag wird dort durch den Tag von `endTime` in
     * deutscher Zeit ersetzt. Ein Termin von 23 bis 1 Uhr endet also am Folgetag. Rechneten wir
     * anders, fände die Doppel-Erkennung (`gleicherZeitraum`) den eigenen Eintrag nicht wieder.
     */
    endDate: mitFenster && neu.endTime ? tagAusIso(neu.endTime) : neu.endDate,
    ...(neu.startTime && neu.endTime ? { startTime: neu.startTime, endTime: neu.endTime } : {}),
    // Reihenfolge: was die App schickt, sonst der Grund des Eintrags, sonst der konfigurierte
    // Standard. Beim Ändern eines „Urlaub" bleibt es damit Urlaub, wenn der Nutzer nichts umstellt.
    absenceReasonId: neu.reasonId ?? herkunft.reasonId ?? config.absenceReasonId,
    // Der Marker kennzeichnet, dass App oder Sync den Eintrag angelegt haben. Beim Ändern eines
    // fremden Eintrags darf er NICHT dazukommen – sonst würde der Excel-Sync ihn anfassen.
    comment: herkunft.mitMarker === false ? (neu.comment ?? '').trim() : mitMarker(neu.comment),
  };
}

/**
 * Der frisch geschriebene Eintrag als App-Sicht – **die eine Stelle** (23.09.2026, Code-Check).
 *
 * Anlegen und Ändern bauten diese Antwort getrennt zusammen, und beim Ändern fehlten `startTime`/
 * `endTime`: Die Antwort meldete „ganztägig", obwohl das Fenster in ChurchTools stand. Folgenlos nur,
 * weil die App nach jeder Änderung neu lädt – für den nächsten Aufrufer eine Falle. Genau die halb
 * umgesetzte Regel, gegen die dieses Projekt seine Arbeitsregeln geschrieben hat.
 */
function alsAbsence(id: number, body: ReturnType<typeof absenceBody>): Absence {
  return zuAbsence({
    id,
    startDate: body.startDate,
    endDate: body.endDate,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    comment: body.comment,
  });
}

/**
 * Gibt es schon einen eigenen Eintrag mit genau diesem Zeitraum?
 *
 * **Das Zeitfenster gehört zum Vergleich** (22.09.2026). Ohne es wäre der zweite Termin desselben
 * Tages ein „Doppel" und würde stillschweigend verschluckt – genau der Fall, für den die Uhrzeiten
 * überhaupt eingeführt wurden. Ganztägig (`null`) und ein Fenster sind damit verschiedene Einträge.
 */
export function gleicherZeitraum(vorhanden: Absence[], neu: NeueAbsence): Absence | undefined {
  return vorhanden.find(
    (a) =>
      a.vonApp &&
      a.startDate === neu.startDate &&
      a.endDate === neu.endDate &&
      (a.startTime ?? null) === (neu.startTime ?? null) &&
      (a.endTime ?? null) === (neu.endTime ?? null),
  );
}

/**
 * Dieselbe Prüfung beim **Ändern**: Ein Eintrag darf auf einen Zeitraum wandern, den es schon gibt –
 * aber nicht auf einen, den ein ANDERER eigener Eintrag belegt. Ohne das `ausser` wäre jede Änderung,
 * die den Zeitraum unverändert lässt (nur der Kommentar), ein „Doppel" und würde abgelehnt.
 */
export function gleicherZeitraumAusser(
  vorhanden: Absence[],
  neu: NeueAbsence,
  ausser: number,
): Absence | undefined {
  return gleicherZeitraum(
    vorhanden.filter((a) => a.id !== ausser),
    neu,
  );
}

/** Termine → Schnellauswahl: Tag herausziehen, nach Beginn sortieren. Reine Funktion. */
export function zuEvents(events: CtEvent[]): AbsenceEvent[] {
  return events
    .filter((e) => typeof e.startDate === 'string' && e.startDate.length >= 10)
    .map((e) => ({
      id: e.id,
      name: e.name,
      date: tagAusIso(e.startDate),
      startDate: e.startDate,
      // Das Ende braucht die App, seit ein Haken das Zeitfenster des Termins einträgt. Fehlt es,
      // steht hier der Start – dann wird der Eintrag ganztägig (siehe `zeitfensterFuer`).
      endDate: typeof e.endDate === 'string' && e.endDate ? e.endDate : e.startDate,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ISO-Tag (`YYYY-MM-DD`) in UTC – liegt in `utils/isoTag.ts`, weil drei Stellen ihn brauchen.
// Der Re-Export bleibt, damit `absencesController` und die Tests ihn weiter von hier holen können.
// Ein reines `export { … } from` genügt NICHT: Dieses Modul benutzt `isoTag` auch selbst, und ein
// Re-Export bringt den Namen nicht in den eigenen Gültigkeitsbereich (der Compiler sagte es sofort).
export { isoTag };

/* ------------------------------------------------------------------ Orchestrierung (mit Netz) */

export async function meineAbwesenheiten(
  cookie: string,
  userId: number,
  from: string,
  to: string,
): Promise<Absence[]> {
  const rows = await getAbsences(cookie, userId, from, to);
  return (rows ?? []).map(zuAbsence).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Eigene Abwesenheit anlegen. Doppelter Zeitraum → 409 mit dem vorhandenen Eintrag als Antwort-
 * Grundlage (der Aufrufer zeigt ihn einfach an, statt einen Fehler zu melden).
 */
export async function abwesenheitAnlegen(
  cookie: string,
  userId: number,
  neu: NeueAbsence,
): Promise<{ absence: Absence; neu: boolean }> {
  const body = absenceBody(neu);
  const vorhanden = await meineAbwesenheiten(cookie, userId, body.startDate, body.endDate);
  const doppel = gleicherZeitraum(vorhanden, body);
  if (doppel) return { absence: doppel, neu: false };
  const id = await createAbsence(cookie, userId, body);
  return { absence: alsAbsence(id, body), neu: true };
}

/**
 * Eigene Abwesenheit löschen. Der Eintrag wird vorher frisch gelesen (`eigenerEintrag`): Die ID
 * allein sagt nicht, ob er zum eigenen Konto gehört – ChurchTools ließe bei der ECG auch fremde
 * Einträge löschen, die App nicht.
 */
export async function abwesenheitLoeschen(
  cookie: string,
  userId: number,
  absenceId: number,
  heute = new Date(),
): Promise<void> {
  const ziel = await eigenerEintrag(cookie, userId, absenceId, heute);
  await deleteAbsence(cookie, userId, ziel.id);
}

/**
 * Den Eintrag heraussuchen – **die eine Stelle**, die „gibt es den?" beantwortet. Löschen und Ändern
 * brauchen dieselbe Antwort; stünde die Suche zweimal da, wäre genau das die Dopplung, die dieses
 * Projekt am häufigsten getroffen hat.
 *
 * **Was hier NICHT mehr steht: eine Marker-Sperre** (Entscheidung Alwin, 05.09.2026). Der Bereich
 * arbeitet ausschließlich auf dem Konto der angemeldeten Person – und in ChurchTools darf sie ihre
 * Abwesenheiten selbst pflegen, also auch hier. Die Messung an der ECG-Instanz gab den Anstoß: Von
 * 31 Beständen trug **keiner** den Marker (der alte Planner schreibt keinen Kommentar, und Alwin
 * pflegt in ChurchTools mit eigenem Text) – die Sperre hätte praktisch alles unantastbar gemacht.
 * Der Marker bleibt Herkunftskennzeichen: Er steuert den **Excel-Sync** (nur eigene Einträge
 * anfassen) und die **Rückfrage vor dem Löschen** in der Oberfläche.
 */
async function eigenerEintrag(
  cookie: string,
  userId: number,
  absenceId: number,
  heute: Date,
): Promise<Absence> {
  // Weites Fenster: Auch ein Eintrag, der vor Monaten begann, soll erreichbar sein.
  const von = isoTag(new Date(heute.getTime() - 400 * 86_400_000));
  const bis = isoTag(new Date(heute.getTime() + 800 * 86_400_000));
  const alle = await meineAbwesenheiten(cookie, userId, von, bis);
  const ziel = alle.find((a) => a.id === absenceId);
  if (!ziel) throw new HttpError(404, 'Diese Abwesenheit gibt es nicht (mehr).');
  return ziel;
}

/** Wie weit die Termine höchstens vorausgeholt werden – ein Jahr, wie bei den Abwesenheiten. */
export const MAX_VORAUS_TAGE = 366;
/** Standard, wenn der Aufrufer kein `bis` nennt: ein halbes Jahr (die Leiste zeigt sechs Monate voraus). */
const STANDARD_VORAUS_TAGE = 183;

/**
 * Kommende Termine von heute **bis zu einem Tag** (`YYYY-MM-DD`, einschließlich).
 *
 * Bis zum 19.09.2026 zählte der Aufrufer Wochen (`weeks=`, 1–26) – passend zum Wochenstreifen. Seit
 * dem Umbau auf Monate (#177, Entwurfsrunde 4–8) sagt die App, bis wann sie Termine braucht: Die
 * Monatsleiste zeigt sechs Monate voraus, das aufgeklappte Raster zwölf. Ein Tag statt einer Zahl,
 * damit „bis Ende Februar" ohne Rechnerei über die Leitung geht.
 */
export async function kommendeTermine(
  cookie: string,
  bis?: string,
  heute = new Date(),
): Promise<AbsenceEvent[]> {
  const from = isoTag(heute);
  const spaetestens = isoTag(new Date(heute.getTime() + MAX_VORAUS_TAGE * 86_400_000));
  const to = bis ?? isoTag(new Date(heute.getTime() + STANDARD_VORAUS_TAGE * 86_400_000));
  if (to < from) throw new HttpError(400, 'Das Ende liegt vor heute.');
  if (to > spaetestens) throw new HttpError(400, 'Höchstens ein Jahr voraus.');
  return zuEvents(await getEvents(cookie, from, to));
}

/**
 * **Eine eigene Abwesenheit ändern** (Wunsch Alwin, 05.09.2026: „meine Abwesenheiten sollen
 * bearbeitbar bleiben").
 *
 * ChurchTools kennt kein Ändern von Abwesenheiten – es gibt nur `POST` und `DELETE` (gemessen
 * 16.07.2026, und der alte Planner machte es seit Jahren genauso). Also: **erst den neuen Eintrag
 * anlegen, dann den alten löschen.** Die Reihenfolge ist keine Stilfrage – andersherum stünde nach
 * einem Fehlschlag beim Anlegen gar nichts mehr da, und die Abwesenheit wäre still verschwunden
 * (dieselbe Lehre wie beim Notenblatt-Ersetzen). Scheitert stattdessen das Löschen, existiert der
 * Zeitraum doppelt – unschön, aber sichtbar und von Hand zu bereinigen; deshalb wird es gemeldet.
 */
export async function abwesenheitAendern(
  cookie: string,
  userId: number,
  absenceId: number,
  neu: NeueAbsence,
  heute = new Date(),
): Promise<Absence> {
  const alt = await eigenerEintrag(cookie, userId, absenceId, heute);
  /**
   * **Grund und Herkunft bleiben, wie sie waren.**
   *
   * Ein „Urlaub", den jemand hier verlängert, muss Urlaub bleiben – der Standardgrund der App würde
   * ihn zu „Abwesend" machen. Und er darf **keinen** `[Musikteam]`-Marker bekommen: Der Excel-Sync
   * fasst nur Marker-Einträge an, ein markierter Urlaub wäre also plötzlich Sync-Material und
   * verschwände beim nächsten Lauf, weil er in der Excel nicht steht.
   */
  const body = absenceBody(
    {
      ...neu,
      /**
       * **Das Zeitfenster überlebt eine Änderung** (22.09.2026, gefunden bei der Dopplungs-Suche).
       *
       * Das Fenster-Fenster kommt aus dem Termin, das Änderungs-Fenster („Abwesenheit ändern")
       * kennt nur Datum, Grund und Kommentar. Ohne diese Zeilen würde aus einem Eintrag für den
       * Vormittagstermin beim bloßen Ändern des Kommentars ein **ganztägiger** – und der zweite
       * Termin des Tages wäre plötzlich mit abgemeldet. Bleiben die Tage gleich, bleiben also auch
       * die Uhrzeiten. Wandert der Eintrag auf andere Tage, ergibt das Fenster keinen Sinn mehr und
       * entfällt.
       */
      ...(neu.startTime ||
      neu.endTime ||
      neu.startDate !== alt.startDate ||
      neu.endDate !== alt.endDate
        ? {}
        : { startTime: alt.startTime ?? undefined, endTime: alt.endTime ?? undefined }),
    },
    {
      reasonId: alt.reasonId,
      mitMarker: alt.vonApp,
    },
  );
  const vorhanden = await meineAbwesenheiten(cookie, userId, body.startDate, body.endDate);
  if (gleicherZeitraumAusser(vorhanden, body, absenceId)) {
    throw new HttpError(409, 'Für diesen Zeitraum gibt es schon einen Eintrag.');
  }
  const id = await createAbsence(cookie, userId, body);
  try {
    await deleteAbsence(cookie, userId, alt.id);
  } catch {
    throw new HttpError(
      502,
      'Die Änderung wurde eingetragen, der alte Eintrag ließ sich aber nicht entfernen. Bitte in ChurchTools nachsehen.',
    );
  }
  return alsAbsence(id, body);
}

/* ------------------------------------------------------------------ Abwesenheitsgründe */

/**
 * **Die Abwesenheitsgründe der Gemeinde** (Wunsch Alwin, 05.09.2026: „bitte immer wieder bei
 * ChurchTools aktualisieren, man kann da Gründe einstellen" – also keine fest verdrahtete Liste).
 *
 * Gemessen am 05.09.2026: Die `/api/`-Welt hat keinen Endpunkt dafür (`/masterdata/absencereasons`,
 * `/absencereasons`, `/absencereason` antworten alle 404). Die Gründe stehen in **derselben**
 * `getMasterData`-Antwort der alten Schnittstelle, aus der schon die Lied-Kategorien kommen – unter
 * `absent_reason`, als Objekt `{ "1": { id, bezeichnung, sortkey } }` mit Zeichenketten-IDs und dem
 * Namensfeld `bezeichnung`. Deshalb wird hier kein neuer Weg gebaut, sondern der vorhandene benutzt.
 *
 * Die Namen der Standardgründe sind Übersetzungsschlüssel (`absent.reason.vacation`) – lesbar macht
 * sie `grundLesbar` in `@shared/absences`, eigene Gründe der Gemeinde gehen unverändert durch.
 */
const GRUND_MELDUNGEN = {
  verweigert: 'Keine Berechtigung, die Abwesenheitsgründe in ChurchTools zu lesen.',
  abgelehnt: 'ChurchTools hat die Anfrage nach den Abwesenheitsgründen abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Antwort für die Abwesenheitsgründe.',
  fehlgeschlagen: 'Die Abwesenheitsgründe konnten nicht geladen werden.',
  innenUnlesbar: 'Die Liste der Abwesenheitsgründe war nicht lesbar.',
};

interface RohGrund {
  id?: string | number;
  bezeichnung?: string;
  sortkey?: string | number;
}

/** Reine Funktion: die `absent_reason`-Struktur der alten Schnittstelle → sortierte Liste. */
export function zuGruenden(roh: unknown): AbsenceReason[] {
  // Objekt („{1: {...}}") ODER Array – beides ist bei dieser Schnittstelle schon vorgekommen.
  const werte: RohGrund[] = Array.isArray(roh)
    ? (roh as RohGrund[])
    : roh && typeof roh === 'object'
      ? Object.values(roh as Record<string, RohGrund>)
      : [];
  return werte
    .map((g) => ({
      id: ctId(g.id),
      name: grundLesbar(g.bezeichnung),
      sort: Number(g.sortkey ?? 0),
    }))
    .filter(
      (g): g is { id: number; name: string; sort: number } => g.id !== null && g.name !== null,
    )
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map(({ id, name }) => ({ id, name, standard: id === config.absenceReasonId }));
}

/**
 * Gründe holen – je Sitzung eine Minute gemerkt. Sie ändern sich fast nie, und die Liste hängt an
 * jedem Öffnen des Fensters; ohne Memo wäre das ein ChurchTools-Aufruf pro Fenster.
 */
export async function abwesenheitsGruende(cookie: string): Promise<AbsenceReason[]> {
  const gemerkt = gruendeMemo.get(cookie);
  if (gemerkt !== undefined) return gemerkt;
  const daten = (await ctAjax(cookie, 'getMasterData', {}, GRUND_MELDUNGEN)) as {
    absent_reason?: unknown;
  };
  const liste = zuGruenden(daten.absent_reason);
  if (liste.length > 0) gruendeMemo.set(cookie, liste);
  return liste;
}
