/**
 * Verfügbarkeit / Abwesenheiten (#177) – der generische Kern.
 *
 * Musiker pflegen ihre **eigenen** Abwesenheiten in ChurchTools, mit dem eigenen Login. Drei Regeln,
 * alle an dieser einen Stelle:
 *  - **Nur das eigene Konto.** Die Personen-ID kommt aus der Sitzung (`userId`), nie aus dem Request.
 *    ChurchTools ließe bei der ECG auch fremde Einträge zu (Nebenbefund 16.07.2026) – die App nicht.
 *  - **Nur Marker-Einträge werden gelöscht** (`@shared/absences`). Ein manuell in ChurchTools
 *    eingetragener Urlaub wird angezeigt, aber nie angefasst.
 *  - **Kein Doppel.** Denselben Zeitraum ein zweites Mal einzutragen legt keinen zweiten Eintrag an.
 *
 * Kein Excel hier – der Sync ist ein eigener Dienst (`excel-sync/`), siehe Plan §12.
 */
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { istMarkerEintrag, markerFreitext, mitMarker } from '@shared/absences/index';
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getAbsences, getEvents } from './ctRead.js';
import type { CtAbsence, CtEvent } from './ctTypes.js';
import { createAbsence, deleteAbsence } from './ctWrite.js';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Längster Zeitraum, den die App eintragen lässt – ein Jahr; alles darüber ist ein Tippfehler. */
export const MAX_TAGE = 366;

/** ChurchTools-Datensatz → App-Sicht. Reine Funktion, testbar ohne Netz. */
export function zuAbsence(a: CtAbsence): Absence {
  return {
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate,
    comment: markerFreitext(a.comment),
    reason: a.absenceReason?.name ?? null,
    eigene: istMarkerEintrag(a.comment),
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
export function absenceBody(neu: NeueAbsence): {
  startDate: string;
  endDate: string;
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
  return {
    startDate: neu.startDate,
    endDate: neu.endDate,
    absenceReasonId: config.absenceReasonId,
    comment: mitMarker(neu.comment),
  };
}

/** Gibt es schon einen eigenen Eintrag mit genau diesem Zeitraum? */
export function gleicherZeitraum(vorhanden: Absence[], neu: NeueAbsence): Absence | undefined {
  return vorhanden.find(
    (a) => a.eigene && a.startDate === neu.startDate && a.endDate === neu.endDate,
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
      date: e.startDate.slice(0, 10),
      startDate: e.startDate,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** ISO-Tag (`YYYY-MM-DD`) eines Zeitpunkts in UTC – für Standard-Zeitfenster. */
export function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  return {
    absence: zuAbsence({
      id,
      startDate: body.startDate,
      endDate: body.endDate,
      comment: body.comment,
    }),
    neu: true,
  };
}

/**
 * Eigene Abwesenheit löschen – nur Marker-Einträge. Der Eintrag wird vorher frisch gelesen: Die
 * ID allein sagt nicht, ob er von uns stammt, und ChurchTools würde auch einen manuellen Urlaub
 * löschen.
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
 * Den eigenen Eintrag heraussuchen – **die eine Stelle**, die „gehört mir?" beantwortet. Löschen und
 * Ändern brauchen dieselbe Antwort; stünde die Prüfung zweimal da, wäre genau das die Dopplung, die
 * dieses Projekt am häufigsten getroffen hat.
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
  if (!ziel.eigene) {
    throw new HttpError(
      403,
      'Dieser Eintrag wurde direkt in ChurchTools angelegt und lässt sich nur dort ändern.',
    );
  }
  return ziel;
}

/** Kommende Termine der nächsten `wochen` Wochen – alle Kalender, die das Konto sehen darf. */
export async function kommendeTermine(
  cookie: string,
  wochen: number,
  heute = new Date(),
): Promise<AbsenceEvent[]> {
  const from = isoTag(heute);
  const to = isoTag(new Date(heute.getTime() + wochen * 7 * 86_400_000));
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
  const body = absenceBody(neu);
  const alt = await eigenerEintrag(cookie, userId, absenceId, heute);
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
  return zuAbsence({
    id,
    startDate: body.startDate,
    endDate: body.endDate,
    comment: body.comment,
  });
}
