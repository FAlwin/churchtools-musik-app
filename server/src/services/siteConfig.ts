/**
 * Feste ChurchTools-Version: Aussehen ist fix. Persistiert wird nur der
 * Gemeinde-Name (`orgName`) in einer `site.json` auf dem Volume – ohne DB.
 * Fehlt die Datei, gelten die Standardwerte.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
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

// Rollen-Freigabe je Gruppe für globale Anmerkungen. Leere Listen = niemand (kein „alle").
const noteRoleSchema = z.object({
  groupId: z.number().int().positive(),
  view: z.array(z.number().int().positive()).max(50).optional().default([]),
  manage: z.array(z.number().int().positive()).max(50).optional().default([]),
});

// Tolerant gegenüber Altfeldern (bestehende site.json aus der White-Label-Phase),
// die nur ignoriert werden. Anpassbar: orgName + links + Anmerkungs-Gruppen/-Rollen.
export const siteConfigSchema = z
  .object({
    orgName: z.string().trim().min(1).max(80),
    // Obergrenze als reine Missbrauchs-Bremse, weit über realer Nutzung.
    links: z.array(linkSchema).max(50).optional().default([]),
    // ChurchTools-Gruppen-IDs für „globale" Anmerkungen; leer = Funktion aus.
    musicianGroupIds: z.array(z.number().int().positive()).max(50).optional().default([]),
    // Abwärtskompatibel: frühere Einzel-ID (wird beim Einlesen in das Array überführt).
    musicianGroupId: z.number().int().positive().nullable().optional(),
    // Rollen-Freigabe je Gruppe (Sehen/Verwalten).
    noteRoles: z.array(noteRoleSchema).max(50).optional().default([]),
  })
  .passthrough();

let cache: SiteConfig | null = null;

type Editable = Pick<SiteConfig, 'orgName' | 'links' | 'musicianGroupIds' | 'noteRoles'>;

/** Setzt eine eingelesene/eingehende Konfiguration auf die festen Felder + anpassbare Werte zusammen. */
function normalize({
  orgName,
  links = [],
  musicianGroupIds = [],
  noteRoles = [],
}: Partial<Editable> & { orgName: string }): SiteConfig {
  // Duplikate entfernen (falls mehrfach übergeben).
  const groupIds = [...new Set(musicianGroupIds)];
  const groupSet = new Set(groupIds);
  // Nur Rollen-Freigaben für tatsächlich gewählte Gruppen behalten; Rollen-IDs deduplizieren.
  const roles = noteRoles
    .filter((r) => groupSet.has(r.groupId))
    .map((r) => ({
      groupId: r.groupId,
      view: [...new Set(r.view)],
      manage: [...new Set(r.manage)],
    }));
  return {
    appName: DEFAULT_SITE_CONFIG.appName,
    description: DEFAULT_SITE_CONFIG.description,
    orgName,
    links,
    musicianGroupIds: groupIds,
    noteRoles: roles,
  };
}

/** Aktuelle Konfiguration (gecacht). Fällt bei Fehlern/fehlender Datei auf Defaults zurück. */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(config.siteConfigPath, 'utf-8');
    const parsed = siteConfigSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      // Altbestand: hatte nur die Einzel-ID `musicianGroupId` → in das Array überführen.
      const ids =
        parsed.data.musicianGroupIds.length > 0
          ? parsed.data.musicianGroupIds
          : parsed.data.musicianGroupId != null
            ? [parsed.data.musicianGroupId]
            : [];
      cache = normalize({
        orgName: parsed.data.orgName,
        links: parsed.data.links,
        musicianGroupIds: ids,
        noteRoles: parsed.data.noteRoles,
      });
    } else {
      cache = { ...DEFAULT_SITE_CONFIG };
    }
  } catch {
    cache = { ...DEFAULT_SITE_CONFIG };
  }
  return cache;
}

/** Schreibt die Konfiguration atomar (orgName + links + musicianGroupIds) und aktualisiert den Cache. */
export async function saveSiteConfig(next: Partial<Editable> & { orgName: string }): Promise<SiteConfig> {
  const cfg = normalize(next);
  const dir = path.dirname(config.siteConfigPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${config.siteConfigPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), 'utf-8');
  await fs.rename(tmp, config.siteConfigPath);
  cache = cfg;
  return cache;
}
