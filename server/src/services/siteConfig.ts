/**
 * Feste ChurchTools-Version: Aussehen ist fix. Persistiert wird nur der
 * Gemeinde-Name (`orgName`) in einer `site.json` auf dem Volume – ohne DB.
 * Fehlt die Datei, gelten die Standardwerte.
 */
import { z } from 'zod';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import { config } from '../config.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

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

// Rollen-Freigabe je Gruppe für Team-Notizen. Leere Liste = niemand (kein „alle").
// `view`/`manage` = kurzlebiges Zwischenformat aus der Entwicklung – wird beim Einlesen in
// `roles` überführt (Vereinigung), damit eine Staging-Konfiguration nicht verloren geht.
const noteRoleSchema = z
  .object({
    groupId: z.number().int().positive(),
    roles: z.array(z.number().int().positive()).max(50).optional().default([]),
    view: z.array(z.number().int().positive()).max(50).optional().default([]),
    manage: z.array(z.number().int().positive()).max(50).optional().default([]),
  })
  .transform((r) => ({
    groupId: r.groupId,
    roles: r.roles.length > 0 ? r.roles : [...new Set([...r.view, ...r.manage])],
  }));

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
    .map((r) => ({ groupId: r.groupId, roles: [...new Set(r.roles)] }));
  return {
    appName: DEFAULT_SITE_CONFIG.appName,
    description: DEFAULT_SITE_CONFIG.description,
    orgName,
    links,
    musicianGroupIds: groupIds,
    noteRoles: roles,
  };
}

/**
 * Aktuelle Konfiguration (gecacht).
 *
 * Defaults gibt es NUR, wenn die Datei fehlt oder inhaltlich nicht zum Schema passt. Ein
 * **Lesefehler** (EACCES/EIO) oder beschädigtes JSON wirft jetzt (#273): Vorher fiel beides auf die
 * Defaults zurück, und das nächste Speichern eines Admins hätte Gemeindename, Links und
 * Gruppen-/Rollen-Zuweisungen durch die Defaults ersetzt.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  const raw = await readJsonStore<unknown>(config.siteConfigPath, 'Branding-Einstellungen');
  if (raw === null) {
    cache = { ...DEFAULT_SITE_CONFIG };
    return cache;
  }
  {
    const parsed = siteConfigSchema.safeParse(raw);
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
      // Inhaltlich unpassend (z. B. handgeschriebene Datei) → Defaults, wie bisher.
      cache = { ...DEFAULT_SITE_CONFIG };
    }
  }
  return cache;
}

/** Schreibt die Konfiguration atomar (orgName + links + musicianGroupIds) und aktualisiert den Cache. */
export async function saveSiteConfig(
  next: Partial<Editable> & { orgName: string },
): Promise<SiteConfig> {
  const cfg = normalize(next);
  await writeJsonStore(config.siteConfigPath, JSON.stringify(cfg, null, 2));
  cache = cfg; // erst nach erfolgreichem Schreiben (#273)
  return cache;
}
