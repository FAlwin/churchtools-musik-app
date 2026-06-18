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

/** Hintergrundfarbe des Splash-Screens (entspricht --bg). */
const BACKGROUND_COLOR = '#FFFCF2';

/**
 * Erzeugt das PWA-Manifest zur Laufzeit aus dem Branding (Phase C).
 * So zeigt auch „Zum Home-Bildschirm" Name/Farbe/Logo der jeweiligen Gemeinde.
 */
export async function getManifestCtrl(_req: Request, res: Response): Promise<void> {
  const cfg = await getSiteConfig();

  // Icon: hochgeladenes Logo, sonst die mitgelieferten Standard-Icons.
  let icons;
  if (cfg.logoDataUrl) {
    const mime = cfg.logoDataUrl.match(/^data:(image\/[\w+.-]+);/)?.[1] ?? 'image/png';
    icons = [{ src: '/api/site-logo', sizes: 'any', type: mime, purpose: 'any' }];
  } else {
    icons = [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
  }

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    name: cfg.appName,
    short_name: cfg.shortName,
    description: cfg.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: cfg.primaryColor,
    background_color: BACKGROUND_COLOR,
    icons,
  });
}
