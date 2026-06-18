/**
 * Endpunkte für den (festen) Gemeinde-Namen.
 *  - GET /api/site-config (öffentlich): aktuelle Werte – auch für den Login-Screen
 *  - PUT /api/site-config (nur Admin):  Gemeinde-Namen speichern
 */
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { getSiteConfig, saveSiteConfig, siteConfigSchema } from '../services/siteConfig.js';

export async function getSiteConfigCtrl(_req: Request, res: Response): Promise<void> {
  res.json(await getSiteConfig());
}

export async function putSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const parsed = siteConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.');
  }
  res.json(await saveSiteConfig(parsed.data.orgName));
}
