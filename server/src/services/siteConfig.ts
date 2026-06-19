/**
 * Feste ChurchTools-Version: Aussehen ist fix. Persistiert wird nur der
 * Gemeinde-Name (`orgName`) in einer `site.json` auf dem Volume – ohne DB.
 * Fehlt die Datei, gelten die Standardwerte.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_SITE_CONFIG, type SiteConfig, type SiteLink } from '@shared/types/index';
import { config } from '../config.js';

/** Nur echte Web-Links zulassen – verhindert `javascript:`/`data:`-XSS in gerenderten Links. */
const linkSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(60),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), 'Nur http(s)-Adressen sind erlaubt.'),
  showOnLogin: z.boolean(),
});

// Tolerant gegenüber Altfeldern (bestehende site.json aus der White-Label-Phase),
// die nur ignoriert werden. Anpassbar: orgName + links.
export const siteConfigSchema = z
  .object({
    orgName: z.string().trim().min(1).max(80),
    // Obergrenze als reine Missbrauchs-Bremse, weit über realer Nutzung.
    links: z.array(linkSchema).max(50).optional().default([]),
  })
  .passthrough();

let cache: SiteConfig | null = null;

/** Setzt eine eingelesene/eingehende Konfiguration auf die festen Felder + anpassbare Werte zusammen. */
function normalize(orgName: string, links: SiteLink[] = []): SiteConfig {
  return {
    appName: DEFAULT_SITE_CONFIG.appName,
    description: DEFAULT_SITE_CONFIG.description,
    orgName,
    links,
  };
}

/** Aktuelle Konfiguration (gecacht). Fällt bei Fehlern/fehlender Datei auf Defaults zurück. */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(config.siteConfigPath, 'utf-8');
    const parsed = siteConfigSchema.safeParse(JSON.parse(raw));
    cache = parsed.success ? normalize(parsed.data.orgName, parsed.data.links) : { ...DEFAULT_SITE_CONFIG };
  } catch {
    cache = { ...DEFAULT_SITE_CONFIG };
  }
  return cache;
}

/** Schreibt die Konfiguration atomar (orgName + links) und aktualisiert den Cache. */
export async function saveSiteConfig(orgName: string, links: SiteLink[] = []): Promise<SiteConfig> {
  const next = normalize(orgName, links);
  const dir = path.dirname(config.siteConfigPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${config.siteConfigPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf-8');
  await fs.rename(tmp, config.siteConfigPath);
  cache = next;
  return cache;
}
