import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/ctAuth.js';
import { ctCookie } from '../utils/ctCookie.js';
import * as absences from '../services/absences.js';
import type { NeueAbsence } from '@shared/types/index';
import type { GleicheSchluessel } from '../utils/schemaSpiegel.js';

/** Eigene Konto-ID – wie im Anmerkungs-Controller: aus der Sitzung, sonst per whoami. */
async function myUserId(req: Request): Promise<number> {
  return req.ctUserId ?? (await getUserId(ctCookie(req)));
}

// Dieselbe Regex wie `absenceBody` im Service (Dopplungs-Suche 18.09.2026): Hier weist sie früh mit
// 400 ab, dort hält sie den Service auch ohne Controller prüfbar – eine Regel, zwei Prüfstellen.
const isoTag = z.string().regex(absences.ISO_TAG, 'Datum als JJJJ-MM-TT.');

const neueAbsenceSchema = z.object({
  startDate: isoTag,
  endDate: isoTag,
  /**
   * **Zeitfenster** (22.09.2026) – ISO-Zeitpunkte, wie ChurchTools sie erwartet.
   *
   * Sie haben hier gefehlt, und zod **entfernt** unbekannte Felder stillschweigend: Die App schickte
   * die Uhrzeit des Termins, der Eintrag wurde trotzdem ganztägig, und beide Termine des Tages
   * hingen wieder zusammen. Aufgefallen ist das erst beim Durchklicken – Tests auf beiden Seiten
   * waren grün, weil der Bruch genau dazwischen lag.
   */
  // `offset: true` ist Absicht: Ohne das lehnt zod `2026-10-04T10:00:00+02:00` ab. Die ECG-Instanz
  // liefert `…Z` (gemessen), aber die App wird an andere Gemeinden verteilt – dort dürfte sonst
  // jeder Haken mit 400 scheitern (Code-Check 23.09.2026, empirisch nachgestellt).
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  comment: z.string().trim().max(200).optional(),
  /** Grund aus `GET /api/absences/reasons`; ChurchTools lehnt eine unbekannte ID selbst ab. */
  reasonId: z.coerce.number().int().positive().optional(),
});
// Compile-Wächter wie bei den Anmerkungen: Zod-Form und geteilter Typ bleiben deckungsgleich.
const _zodSubsetOfType = (a: z.infer<typeof neueAbsenceSchema>): NeueAbsence => a;
const _typeSubsetOfZod = (n: NeueAbsence): z.infer<typeof neueAbsenceSchema> => n;
void _zodSubsetOfType;
void _typeSubsetOfZod;
// Der eigentliche Wächter: Er schlägt auch bei OPTIONALEN Feldern an – die beiden Zuweisungen oben
// können das nicht, und genau so sind `startTime`/`endTime` am 22.09.2026 durchgerutscht.
const _schluessel: GleicheSchluessel<NeueAbsence, z.infer<typeof neueAbsenceSchema>> = true;
void _schluessel;

const fensterSchema = z.object({ from: isoTag.optional(), to: isoTag.optional() });
/** Termine: nur ein `to` – wie weit voraus, entscheidet die Monatsansicht der App; der Service deckelt auf ein Jahr. */
const terminFensterSchema = z.object({ to: isoTag.optional() });

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

/** PUT /api/absences/:id – eigenen Eintrag ändern (neu anlegen, alten entfernen). */
export async function putAbsence(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const neu = neueAbsenceSchema.parse(req.body);
  res.json(await absences.abwesenheitAendern(ctCookie(req), userId, id, neu));
}

/** DELETE /api/absences/:id – jeden eigenen Eintrag (404, wenn er nicht zum Konto gehört). */
export async function deleteAbsence(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await absences.abwesenheitLoeschen(ctCookie(req), userId, id);
  res.status(204).end();
}

/** GET /api/absences/events?to= – kommende Termine von heute bis `to` (Standard: ein halbes Jahr, höchstens ein Jahr). */
export async function getAbsenceEvents(req: Request, res: Response): Promise<void> {
  const q = terminFensterSchema.parse(req.query);
  res.json(await absences.kommendeTermine(ctCookie(req), q.to));
}

/** GET /api/absences/reasons – die Abwesenheitsgründe der Gemeinde (für die Auswahl im Fenster). */
export async function getAbsenceReasons(req: Request, res: Response): Promise<void> {
  res.json(await absences.abwesenheitsGruende(ctCookie(req)));
}
