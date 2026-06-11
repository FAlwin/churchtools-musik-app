import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getServicesWithSetlists,
  getSetlistSongs,
  saveEcgChordpro,
  deleteEcgChordpro,
} from '../services/setlistBuilder.js';

/** Standard-Zeitfenster: 1 Woche zurück bis 6 Wochen voraus. */
function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 42 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** GET /api/services – Gottesdienste mit Setlist. */
export async function getServices(req: Request, res: Response): Promise<void> {
  const def = defaultWindow();
  const from = dateSchema.parse(req.query.from) ?? def.from;
  const to = dateSchema.parse(req.query.to) ?? def.to;
  const services = await getServicesWithSetlists(req.ctCookie as string, from, to);
  res.json(services);
}

const idSchema = z.coerce.number().int().positive();

/** GET /api/services/:eventId/setlist – Songs einer Setlist inkl. ChordPro. */
export async function getSetlist(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const songs = await getSetlistSongs(req.ctCookie as string, eventId);
  res.json(songs);
}

const editSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  text: z.string().min(1, 'Text fehlt'),
});

/** PUT /api/songs/:songId/chordpro – bearbeitete ECG-Version speichern. */
export async function putChordpro(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId, text } = editSchema.parse(req.body);
  await saveEcgChordpro(req.ctCookie as string, songId, arrangementId, text);
  res.json({ ok: true });
}

const deleteSchema = z.object({ arrangementId: z.coerce.number().int().positive() });

/** DELETE /api/songs/:songId/chordpro – ECG-Version löschen (auf Original zurücksetzen). */
export async function deleteChordpro(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId } = deleteSchema.parse(req.body);
  await deleteEcgChordpro(req.ctCookie as string, songId, arrangementId);
  res.json({ ok: true });
}
