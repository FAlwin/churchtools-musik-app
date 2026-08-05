import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/churchtools.js';
import * as store from '../services/userSettings.js';
import { ctCookie } from '../utils/ctCookie.js';
import { songIdsFromQuery } from '../utils/songIdsQuery.js';

/** GET /api/settings?songs=1,2,3 – kontobezogene Lied-Einstellungen zu diesen Liedern. */
export async function getSettings(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(ctCookie(req));
  const songs = songIdsFromQuery(req.query.songs);
  res.json(await store.getSettings(userId, songs));
}

const bodySchema = z.record(z.string().max(120), z.string().max(4000).nullable());

/** PUT /api/settings – mehrere Einstellungen setzen/entfernen (Merge). */
export async function putSettings(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(ctCookie(req));
  const entries = bodySchema.parse(req.body);
  await store.putSettings(userId, entries);
  res.json({ ok: true });
}
