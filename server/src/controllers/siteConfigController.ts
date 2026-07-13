/**
 * Endpunkte für den (festen) Gemeinde-Namen.
 *  - GET /api/site-config (öffentlich): aktuelle Werte – auch für den Login-Screen
 *  - PUT /api/site-config (nur Admin):  Gemeinde-Namen speichern
 */
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { getSiteConfig, saveSiteConfig, siteConfigSchema } from '../services/siteConfig.js';
import { getGroups, getGroupRoles } from '../services/churchtools.js';
import { readSession, isSessionExpired } from '../middleware/session.js';

/**
 * GET /api/site-config – öffentlich (der Login-Screen braucht Name/Logo/Links, bevor man
 * angemeldet ist). Für NICHT angemeldete Aufrufe werden nur die Anzeige-Felder geliefert; die
 * internen Gruppen-/Rollen-IDs (`musicianGroupIds`/`noteRoles`) bleiben leer, damit sie nicht
 * unauthentifiziert nach außen gelangen. Angemeldete (u. a. die Admin-Einstellungen) erhalten
 * die vollständige Konfiguration.
 */
export async function getSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const cfg = await getSiteConfig();
  const session = readSession(req);
  const authed = !!session && !isSessionExpired(session.issuedAt);
  if (authed) {
    res.json(cfg);
    return;
  }
  res.json({
    appName: cfg.appName,
    description: cfg.description,
    orgName: cfg.orgName,
    links: cfg.links,
    musicianGroupIds: [],
    noteRoles: [],
  });
}

export async function putSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const parsed = siteConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.');
  }
  res.json(
    await saveSiteConfig({
      orgName: parsed.data.orgName,
      links: parsed.data.links,
      musicianGroupIds: parsed.data.musicianGroupIds,
      noteRoles: parsed.data.noteRoles,
    }),
  );
}

/** GET /api/groups (nur Admin) – ChurchTools-Gruppen für das Dropdown „Gruppen-Zuweisung". */
export async function getGroupsCtrl(req: Request, res: Response): Promise<void> {
  res.json(await getGroups(req.ctCookie as string));
}

/** GET /api/groups/:id/roles (nur Admin) – Rollen einer Gruppe für die Rollen-Zuweisung. */
export async function getGroupRolesCtrl(req: Request, res: Response): Promise<void> {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new HttpError(400, 'Ungültige Gruppen-ID.');
  }
  res.json(await getGroupRoles(req.ctCookie as string, groupId));
}
