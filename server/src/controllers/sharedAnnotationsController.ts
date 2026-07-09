/**
 * Endpunkte für die globalen (Team-)Anmerkungen. Rechte werden serverseitig erzwungen:
 *  - Lesen  (GET): nur `canUseGlobalNotes` – sonst leere Antwort (Nicht-Musiker bekommen nichts).
 *  - Schreiben/Löschen (PUT/DELETE): nur `canManageGlobalNotes` – sonst 403.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getCapabilities, whoami } from '../services/churchtools.js';
import * as store from '../services/sharedAnnotations.js';
import { HttpError } from '../middleware/errorHandler.js';

const authorSchema = z.object({ id: z.number(), name: z.string().max(120) });

const textSchema = z.object({
  id: z.number(),
  fx: z.number(),
  fy: z.number(),
  text: z.string().max(2000),
  color: z.string().max(20),
  sizeCqh: z.number(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  // Autor optional (neue Texte tragen ihn noch nicht – der Server stempelt ihn dann).
  author: authorSchema.optional(),
});

const sharedSchema = z.object({
  strokes: z.string().max(6_000_000).nullable().optional(),
  texts: z.array(textSchema).max(500).optional(),
});

// Schlüsselform wie bei den privaten Anmerkungen (ohne Zoom-Layout-Suffix – global kennt keinen Zoom).
const keySchema = z
  .string()
  .max(120)
  .regex(/^song\d+_v[a-z0-9-]+_\d+$/i, 'Ungültiger Anmerkungs-Schlüssel.');

/** GET /api/annotations/shared?songs=1,2,3 – globale Anmerkungen (nur für Berechtigte). */
export async function getSharedAnnotations(req: Request, res: Response): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string);
  if (!caps.canUseGlobalNotes) {
    res.json({}); // Nicht-Musiker erhalten globale Anmerkungen gar nicht.
    return;
  }
  const songs = String(req.query.songs ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  res.json(await store.getSharedAnnotations(songs));
}

/** PUT /api/annotations/shared/:key – globale Anmerkungen einer Seite setzen (nur Verwaltung). */
export async function putSharedAnnotation(req: Request, res: Response): Promise<void> {
  const cookie = req.ctCookie as string;
  const caps = await getCapabilities(cookie);
  if (!caps.canManageGlobalNotes) {
    throw new HttpError(403, 'Keine Berechtigung, globale Anmerkungen zu verwalten.');
  }
  const key = keySchema.parse(req.params.key);
  const partial = sharedSchema.parse(req.body);
  const me = await whoami(cookie);
  const author = { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() };
  await store.putSharedAnnotation(key, partial, author);
  res.json({ ok: true });
}

/** DELETE /api/annotations/shared/:key – globale Anmerkungen einer Seite löschen (nur Verwaltung). */
export async function deleteSharedAnnotation(req: Request, res: Response): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string);
  if (!caps.canManageGlobalNotes) {
    throw new HttpError(403, 'Keine Berechtigung, globale Anmerkungen zu verwalten.');
  }
  const key = keySchema.parse(req.params.key);
  await store.deleteSharedAnnotation(key);
  res.json({ ok: true });
}
