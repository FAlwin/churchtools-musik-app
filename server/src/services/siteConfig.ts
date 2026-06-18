/**
 * Laufzeit-Branding (White-Label). Liest/schreibt eine `site.json` auf einem
 * persistenten Volume – bewusst ohne Datenbank (passt zur DB-losen Architektur).
 * Fehlt die Datei, gelten die Standardwerte (ECG Donrath).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import { config } from '../config.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Erlaubte Logo-Formate als Data-URL. */
const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
/** Obergrenze für das Logo (Roh-Data-URL), grob ~1 MB Bild. */
const MAX_LOGO_CHARS = 1_400_000;

export const siteConfigSchema = z.object({
  appName: z.string().trim().min(1).max(60),
  shortName: z.string().trim().min(1).max(30),
  description: z.string().trim().max(120),
  orgName: z.string().trim().min(1).max(80),
  logoDataUrl: z
    .string()
    .regex(LOGO_DATA_URL, 'Logo muss ein PNG/JPEG/WebP/SVG als Data-URL sein')
    .max(MAX_LOGO_CHARS, 'Logo ist zu groß (max. ~1 MB)')
    .nullable(),
  primaryColor: z.string().regex(HEX, 'Farbe muss ein Hex-Wert wie #00616E sein'),
  accentColor: z.string().regex(HEX, 'Farbe muss ein Hex-Wert wie #EB5E28 sein'),
  ccli: z.string().trim().max(30).nullable(),
});

let cache: SiteConfig | null = null;

/** Aktuelle Konfiguration (gecacht). Fällt bei Fehlern/fehlender Datei auf Defaults zurück. */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(config.siteConfigPath, 'utf-8');
    const parsed = siteConfigSchema.safeParse(JSON.parse(raw));
    cache = parsed.success ? parsed.data : { ...DEFAULT_SITE_CONFIG };
  } catch {
    // Datei fehlt (erster Start) oder ist unlesbar → Defaults
    cache = { ...DEFAULT_SITE_CONFIG };
  }
  return cache;
}

/** Schreibt die Konfiguration atomar und aktualisiert den Cache. */
export async function saveSiteConfig(next: SiteConfig): Promise<SiteConfig> {
  const dir = path.dirname(config.siteConfigPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${config.siteConfigPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf-8');
  await fs.rename(tmp, config.siteConfigPath);
  cache = next;
  return cache;
}
