import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getServicesWithSetlists,
  getAgendaItems,
  saveEcgChordpro,
  deleteEcgChordpro,
  resolveFileUrl,
  getSongLibrary,
  getSongChart,
  getSongUsageMap,
} from '../services/setlistBuilder.js';
import {
  fetchFileBytes,
  reorderAgenda,
  deleteAgendaItem,
  updateAgendaItem,
  createAgendaItem,
  searchSongs,
  getCapabilities,
  getCtServices,
} from '../services/churchtools.js';
import type { AgendaServiceOption, SongSearchResult } from '@shared/types/index';

/** Standard-Zeitfenster: 1 Woche zurück bis 6 Wochen voraus. */
function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 42 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** GET /api/services – Gottesdienste mit Setlist. */
export async function getServices(req: Request, res: Response): Promise<void> {
  const def = defaultWindow();
  const from = dateSchema.parse(req.query.from) ?? def.from;
  const to = dateSchema.parse(req.query.to) ?? def.to;
  const services = await getServicesWithSetlists(req.ctCookie as string, from, to);
  res.json(services);
}

const idSchema = z.coerce.number().int().positive();

const orderSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1),
});

/** PATCH /api/services/:eventId/agenda/order – neue Reihenfolge der Ablaufpunkte speichern. */
export async function putAgendaOrder(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { order } = orderSchema.parse(req.body);
  await reorderAgenda(req.ctCookie as string, eventId, order);
  res.json({ ok: true });
}

const updateItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Titel fehlt').max(255).optional(),
    // arrangementId verknüpft einen bestehenden Punkt mit einem Lied (wandelt ihn in type 'song').
    arrangementId: z.coerce.number().int().positive().optional(),
    // unlink löst eine bestehende Lied-Verknüpfung wieder (Punkt bleibt als Text erhalten).
    unlink: z.boolean().optional(),
    // responsible: Textfeld der Zuständigen (z.B. „[Musik]"); CT löst Dienst-Tokens selbst auf.
    responsible: z.string().trim().max(1000).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.arrangementId !== undefined ||
      d.unlink === true ||
      d.responsible !== undefined,
    { message: 'Titel, arrangementId, unlink oder responsible erforderlich.' },
  );

const createItemSchema = z
  .object({
    type: z.enum(['header', 'text', 'song']),
    title: z.string().trim().max(255).optional(),
    arrangementId: z.coerce.number().int().positive().optional(),
    responsible: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.type !== 'song' || d.arrangementId !== undefined, {
    message: 'Für ein Lied ist arrangementId erforderlich.',
    path: ['arrangementId'],
  });

/** POST /api/services/:eventId/agenda/items – neuen Ablaufpunkt anlegen. */
export async function postAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { type, title, arrangementId, responsible } = createItemSchema.parse(req.body);
  await createAgendaItem(req.ctCookie as string, eventId, {
    type,
    title: title ?? (type === 'header' ? 'Überschrift' : type === 'song' ? 'Lied' : 'Neuer Punkt'),
    arrangementId,
    responsible,
  });
  res.json({ ok: true });
}

const searchSchema = z.string().trim().min(1).max(100);

/** GET /api/songs?query=… – Songsuche für „Lied hinzufügen". */
export async function getSongs(req: Request, res: Response): Promise<void> {
  const query = searchSchema.parse(req.query.query);
  const songs = await searchSongs(req.ctCookie as string, query);
  const result: SongSearchResult[] = songs.map((s) => ({
    songId: s.id,
    name: s.name,
    author: s.author ?? null,
    arrangements: (s.arrangements ?? []).map((a) => ({
      arrangementId: a.id,
      arrangementName: a.name,
      key: a.keyOfArrangement ?? a.key ?? null,
    })),
  }));
  res.json(result);
}

/** PUT /api/services/:eventId/agenda/items/:itemId – Punkt umbenennen oder mit Lied verknüpfen. */
export async function putAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const { title, arrangementId, unlink, responsible } = updateItemSchema.parse(req.body);
  await updateAgendaItem(req.ctCookie as string, eventId, itemId, {
    title,
    arrangementId,
    unlink,
    responsible,
  });
  res.json({ ok: true });
}

/** DELETE /api/services/:eventId/agenda/items/:itemId – einen Ablaufpunkt löschen. */
export async function deleteAgendaItemCtrl(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  await deleteAgendaItem(req.ctCookie as string, eventId, itemId);
  res.json({ ok: true });
}

/** GET /api/song-library – alle Lieder (Standard-Arrangement) für die „Alle Lieder"-Ansicht. */
export async function getSongLibraryCtrl(req: Request, res: Response): Promise<void> {
  const songs = await getSongLibrary(req.ctCookie as string);
  res.json(songs);
}

/** GET /api/capabilities – was der angemeldete Nutzer laut ChurchTools darf. */
export async function getCapabilitiesCtrl(req: Request, res: Response): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string);
  res.json(caps);
}

/** GET /api/agenda-services – ChurchTools-Dienste (für die Verantwortlich-Chips). */
export async function getAgendaServicesCtrl(req: Request, res: Response): Promise<void> {
  const services = await getCtServices(req.ctCookie as string);
  const result: AgendaServiceOption[] = services.map((s) => ({ id: s.id, name: s.name }));
  res.json(result);
}

/** GET /api/song-usage – Nutzungsdaten je Song (Häufigkeit + zuletzt), separat/gecacht. */
export async function getSongUsageCtrl(req: Request, res: Response): Promise<void> {
  const usage = await getSongUsageMap(req.ctCookie as string);
  res.json(usage);
}

const arrSchema = z.coerce.number().int().positive().optional();

/** GET /api/songs/:songId/chart – Chart-Daten eines einzelnen Lieds. */
export async function getSongChartCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = arrSchema.parse(req.query.arrangementId);
  const song = await getSongChart(req.ctCookie as string, songId, arrangementId);
  res.json(song);
}

/** GET /api/services/:eventId/setlist – alle Ablaufpunkte (Lieder inkl. ChordPro). */
export async function getSetlist(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const items = await getAgendaItems(req.ctCookie as string, eventId);
  res.json(items);
}

const editSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  text: z.string().min(1, 'Text fehlt'),
});

/** PUT /api/songs/:songId/chordpro – bearbeitete ECG-Version speichern. */
export async function putChordpro(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId, text } = editSchema.parse(req.body);
  await saveEcgChordpro(req.ctCookie as string, songId, arrangementId, text);
  res.json({ ok: true });
}

/** GET /api/songs/:songId/files/:fileId – Datei (PDF/Bild) aus ChurchTools durchreichen. */
export async function getFile(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const fileId = idSchema.parse(req.params.fileId);
  const cookie = req.ctCookie as string;
  const fileUrl = await resolveFileUrl(cookie, songId, fileId);
  const { buffer, contentType } = await fetchFileBytes(cookie, fileUrl);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}

const deleteSchema = z.object({ arrangementId: z.coerce.number().int().positive() });

/** DELETE /api/songs/:songId/chordpro – ECG-Version löschen (auf Original zurücksetzen). */
export async function deleteChordpro(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId } = deleteSchema.parse(req.body);
  await deleteEcgChordpro(req.ctCookie as string, songId, arrangementId);
  res.json({ ok: true });
}
