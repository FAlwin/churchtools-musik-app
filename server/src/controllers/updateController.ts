/**
 * Endpunkt für den Update-Hinweis in der App.
 *  - GET /api/update-check (öffentlich): neueste veröffentlichte Version (gecacht).
 */
import type { Request, Response } from 'express';
import { getLatestRelease } from '../services/updateCheck.js';

export async function getUpdateInfoCtrl(_req: Request, res: Response): Promise<void> {
  res.json(await getLatestRelease());
}
