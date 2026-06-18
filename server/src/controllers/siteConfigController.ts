/**
 * Endpunkte für das Laufzeit-Branding (White-Label).
 *  - GET  /api/site-config  (öffentlich): aktuelle Werte – auch für den Login-Screen
 *  - GET  /api/site-logo    (öffentlich): Logo-Bytes (für Favicon/Manifest)
 *  - PUT  /api/site-config  (nur Admin):  Werte speichern
 */
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { getSiteConfig, saveSiteConfig, siteConfigSchema } from '../services/siteConfig.js';

export async function getSiteConfigCtrl(_req: Request, res: Response): Promise<void> {
  res.json(await getSiteConfig());
}

/** Liefert das hochgeladene Logo als Bild. 404, wenn keins gesetzt ist (Client nutzt dann das Standard-Logo). */
export async function getSiteLogoCtrl(_req: Request, res: Response): Promise<void> {
  const cfg = await getSiteConfig();
  if (!cfg.logoDataUrl) throw new HttpError(404, 'Kein Logo gesetzt.');
  const match = cfg.logoDataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) throw new HttpError(404, 'Logo unlesbar.');
  const [, mime, b64] = match;
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'no-cache');
  res.send(Buffer.from(b64, 'base64'));
}

export async function putSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const parsed = siteConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.');
  }
  res.json(await saveSiteConfig(parsed.data));
}
