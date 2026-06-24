import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/churchtools.js';
import * as store from '../services/annotations.js';

const textSchema = z.object({
  id: z.number(),
  fx: z.number(),
  fy: z.number(),
  text: z.string().max(2000),
  color: z.string().max(20),
  sizeCqh: z.number(),
});

const annoSchema = z.object({
  // PNG-DataURL der Striche – Obergrenze als Missbrauchs-Bremse (eine Seite).
  strokes: z.string().max(6_000_000).nullable().optional(),
  texts: z.array(textSchema).max(500).optional(),
  zoom: z.object({ x: z.number(), y: z.number(), scale: z.number() }).nullable().optional(),
});

// Schlüsselform: song<id>_v<versionKey>_<seite>
const keySchema = z
  .string()
  .max(120)
  .regex(/^song\d+_v[a-z0-9-]+_\d+$/i, 'Ungültiger Anmerkungs-Schlüssel.');

/** GET /api/annotations?songs=1,2,3 – alle Anmerkungen des Kontos zu diesen Liedern. */
export async function getAnnotations(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(req.ctCookie as string);
  const songs = String(req.query.songs ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  res.json(await store.getAnnotations(userId, songs));
}

/** PUT /api/annotations/:key – Anmerkungen einer Seite aktualisieren (Feld-Merge). */
export async function putAnnotation(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(req.ctCookie as string);
  const key = keySchema.parse(req.params.key);
  const partial = annoSchema.parse(req.body);
  await store.putAnnotation(userId, key, partial);
  res.json({ ok: true });
}

/** DELETE /api/annotations/:key – Anmerkungen einer Seite löschen. */
export async function deleteAnnotation(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(req.ctCookie as string);
  const key = keySchema.parse(req.params.key);
  await store.deleteAnnotation(userId, key);
  res.json({ ok: true });
}
