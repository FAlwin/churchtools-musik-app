import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/ctAuth.js';
import { ctCookie } from '../utils/ctCookie.js';
import * as absences from '../services/absences.js';
import type { NeueAbsence } from '@shared/types/index';

/** Eigene Konto-ID – wie im Anmerkungs-Controller: aus der Sitzung, sonst per whoami. */
async function myUserId(req: Request): Promise<number> {
  return req.ctUserId ?? (await getUserId(ctCookie(req)));
}

const isoTag = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT.');

const neueAbsenceSchema = z.object({
  startDate: isoTag,
  endDate: isoTag,
  comment: z.string().trim().max(200).optional(),
});
// Compile-Wächter wie bei den Anmerkungen: Zod-Form und geteilter Typ bleiben deckungsgleich.
const _zodSubsetOfType = (a: z.infer<typeof neueAbsenceSchema>): NeueAbsence => a;
const _typeSubsetOfZod = (n: NeueAbsence): z.infer<typeof neueAbsenceSchema> => n;
void _zodSubsetOfType;
void _typeSubsetOfZod;

const fensterSchema = z.object({ from: isoTag.optional(), to: isoTag.optional() });
const wochenSchema = z.coerce.number().int().min(1).max(26).default(10);

/** GET /api/absences?from=&to= – eigene Abwesenheiten (Standard: heute bis in einem Jahr). */
export async function getAbsences(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const q = fensterSchema.parse(req.query);
  const heute = new Date();
  const from = q.from ?? absences.isoTag(heute);
  const to = q.to ?? absences.isoTag(new Date(heute.getTime() + 365 * 86_400_000));
  res.json(await absences.meineAbwesenheiten(ctCookie(req), userId, from, to));
}

/**
 * POST /api/absences – eigene Abwesenheit eintragen. 201 bei neuem Eintrag, 200 wenn derselbe
 * Zeitraum schon stand (dann kommt der vorhandene zurück – kein Fehler, kein Doppel).
 */
export async function postAbsence(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const neu = neueAbsenceSchema.parse(req.body);
  const ergebnis = await absences.abwesenheitAnlegen(ctCookie(req), userId, neu);
  res.status(ergebnis.neu ? 201 : 200).json(ergebnis.absence);
}

/** DELETE /api/absences/:id – nur eigene Marker-Einträge (sonst 403). */
export async function deleteAbsence(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await absences.abwesenheitLoeschen(ctCookie(req), userId, id);
  res.status(204).end();
}

/** GET /api/absences/events?weeks= – kommende Termine als Schnellauswahl. */
export async function getAbsenceEvents(req: Request, res: Response): Promise<void> {
  const wochen = wochenSchema.parse(req.query.weeks);
  res.json(await absences.kommendeTermine(ctCookie(req), wochen));
}
