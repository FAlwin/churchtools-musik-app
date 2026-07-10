/**
 * Team-Notizen nach dem PCO-Modell: Anmerkungen bleiben strikt pro Konto; wer mag, TEILT seine
 * Ebene, Berechtigte können sie ANSEHEN (und clientseitig importieren). Rechte werden serverseitig
 * erzwungen (`canUseGlobalNotes` = Mitglied einer freigegebenen Gruppe/Rolle) – mit dem
 * 5-Minuten-Memo, NICHT live gegen ChurchTools je Anfrage (CT-Aussetzer-Lektion).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getCapabilitiesCached, getUserId, whoami } from '../services/churchtools.js';
import { setSharing, isSharing, listSharers } from '../services/sharing.js';
import * as annotations from '../services/annotations.js';
import { getSettings } from '../services/userSettings.js';
import { HttpError } from '../middleware/errorHandler.js';

async function requireTeamNotes(req: Request): Promise<void> {
  const caps = await getCapabilitiesCached(req.ctCookie as string);
  if (!caps.canUseGlobalNotes) {
    throw new HttpError(403, 'Keine Berechtigung für Team-Notizen.');
  }
}

function songIdsOf(req: Request): number[] {
  return String(req.query.songs ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function personIdOf(req: Request): number {
  const id = Number(req.params.personId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Ungültige Personen-ID.');
  return id;
}

/** GET /api/annotations/sharing – teilt DIESES Konto gerade? (für den Schalter im Mehr-Tab) */
export async function getSharing(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(req.ctCookie as string);
  res.json({ enabled: await isSharing(userId) });
}

const sharingSchema = z.object({ enabled: z.boolean() });

/** PUT /api/annotations/sharing – eigenes Teilen ein-/ausschalten (nur Team-Berechtigte). */
export async function putSharing(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  const { enabled } = sharingSchema.parse(req.body);
  const me = await whoami(req.ctCookie as string);
  await setSharing(me.id, `${me.firstName} ${me.lastName}`.trim(), enabled);
  res.json({ enabled });
}

/**
 * GET /api/annotations/sharers?songs=1,2 – wer teilt Anmerkungen zu diesen Liedern?
 * Liefert je teilendem Konto (außer dem eigenen) die Lied-IDs, zu denen es Anmerkungen hat.
 */
export async function getSharers(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  const myId = await getUserId(req.ctCookie as string);
  const songs = songIdsOf(req);
  const out: Array<{ id: number; name: string; songs: number[] }> = [];
  for (const sharer of await listSharers()) {
    if (sharer.id === myId) continue;
    const entries = await annotations.getAnnotations(sharer.id, songs);
    const ids = new Set<number>();
    for (const [key, value] of Object.entries(entries)) {
      // Nur echte Anmerkungen zählen (Zoom ist geräte-/kontopersönlich und wird nie geteilt).
      if (!value.strokes && !(value.texts && value.texts.length)) continue;
      const m = key.match(/^song(\d+)_/);
      if (m) ids.add(Number(m[1]));
    }
    if (ids.size > 0) out.push({ id: sharer.id, name: sharer.name, songs: [...ids] });
  }
  res.json(out);
}

/** Gemeinsame Absicherung der Fremd-Lese-Endpunkte: Berechtigung + die Person muss teilen. */
async function requireSharedFrom(req: Request): Promise<number> {
  await requireTeamNotes(req);
  const personId = personIdOf(req);
  if (!(await isSharing(personId))) {
    throw new HttpError(403, 'Diese Person teilt ihre Anmerkungen nicht.');
  }
  return personId;
}

/** GET /api/annotations/of/:personId?songs=… – geteilte Anmerkungen einer Person (ohne Zoom). */
export async function getAnnotationsOf(req: Request, res: Response): Promise<void> {
  const personId = await requireSharedFrom(req);
  const entries = await annotations.getAnnotations(personId, songIdsOf(req));
  // Zoom ist persönlich: Feld entfernen, reine Zoom-Einträge (Layout-Suffix-Schlüssel) auslassen.
  const out: Record<string, { strokes?: string | null; texts?: unknown[] }> = {};
  for (const [key, value] of Object.entries(entries)) {
    const strokes = value.strokes ?? null;
    const texts = value.texts ?? [];
    if (!strokes && texts.length === 0) continue;
    out[key] = { strokes, texts };
  }
  res.json(out);
}

/**
 * GET /api/settings/of/:personId?songs=… – Lied-Einstellungen einer teilenden Person.
 * Nötig, um ihre Anmerkungen in IHRER Ansicht (Spalten/Schrift/Version) darzustellen.
 */
export async function getSettingsOf(req: Request, res: Response): Promise<void> {
  const personId = await requireSharedFrom(req);
  res.json(await getSettings(personId, songIdsOf(req)));
}
