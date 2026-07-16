import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getServicesWithSetlists,
  getAgendaItems,
  getSetlistFingerprint,
  getSetlistState,
  createVersion,
  updateVersion,
  deleteVersion,
  resolveFileUrl,
  getSongLibrary,
  getSongChart,
  getSongUsageMap,
  invalidateSongUsageCache,
} from '../services/setlistBuilder.js';
import {
  fetchFileBytes,
  reorderAgenda,
  deleteAgendaItem,
  updateAgendaItem,
  setAgendaItemHidden,
  createAgendaItem,
  getSong,
  getCapabilities,
  getUserId,
  getCtServices,
} from '../services/churchtools.js';
import { getSeenSetlists, markSeenSetlist } from '../services/seenSetlists.js';
import type { AgendaServiceOption, SongArrangementOption } from '@shared/types/index';

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
  const cookie = req.ctCookie as string;
  const def = defaultWindow();
  const from = dateSchema.parse(req.query.from) ?? def.from;
  const to = dateSchema.parse(req.query.to) ?? def.to;
  const withHashes = await getServicesWithSetlists(cookie, from, to);
  // „Geändert"-Badge je Konto (#143): mit dem zuletzt gesehenen Fingerabdruck vergleichen. Ohne
  // gemerkten Stand (nie geöffnet) gilt NICHT als geändert. userId best effort aus dem Cookie
  // (seit #149) – fehlt sie, wird ohne Badge ausgeliefert (Komfort-Feature, kein harter Fehler).
  let seen: Awaited<ReturnType<typeof getSeenSetlists>> = {};
  try {
    const userId = req.ctUserId ?? (await getUserId(cookie));
    seen = await getSeenSetlists(userId);
  } catch {
    /* Konto-ID/Datei nicht verfügbar → ohne Badge ausliefern */
  }
  const services = withHashes.map(({ service, hash }) => {
    const prev = seen[String(service.id)];
    return { ...service, setlistChanged: prev != null && prev.hash !== hash };
  });
  res.json(services);
}

// Kurz-Memo je Termin für den Live-Abgleich: Viele offene Geräte pollen alle ~8 s – ChurchTools
// soll dafür höchstens alle paar Sekunden EINMAL gefragt werden, egal wie viele Geräte schauen.
const versionMemo = new Map<number, { hash: string; at: number }>();
const VERSION_MEMO_TTL_MS = 5_000;

/**
 * GET /api/services/:eventId/setlist/version – aktueller Ablauf-Fingerabdruck (Live-Abgleich).
 * Bewusst leichtgewichtig: nur die Roh-Agenda (KEINE ChordPro-Downloads). Der Client pollt das,
 * solange ein Ablauf offen ist, und lädt bei Änderung den vollen Ablauf nach.
 */
export async function getSetlistVersion(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const hit = versionMemo.get(eventId);
  if (hit && Date.now() - hit.at < VERSION_MEMO_TTL_MS) {
    res.json({ hash: hit.hash });
    return;
  }
  // Abgelaufene Fremd-Einträge räumen (Map wächst sonst über Wochen mit alten Terminen).
  for (const [id, v] of versionMemo) {
    if (Date.now() - v.at >= VERSION_MEMO_TTL_MS) versionMemo.delete(id);
  }
  const hash = await getSetlistFingerprint(req.ctCookie as string, eventId);
  versionMemo.set(eventId, { hash, at: Date.now() });
  res.json({ hash });
}

/** POST /api/services/:eventId/seen – merkt den aktuellen Setlist-Stand als „gesehen" (#143). */
export async function markSetlistSeen(req: Request, res: Response): Promise<void> {
  const cookie = req.ctCookie as string;
  const eventId = idSchema.parse(req.params.eventId);
  const userId = req.ctUserId ?? (await getUserId(cookie));
  const { hash, items } = await getSetlistState(cookie, eventId);
  await markSeenSetlist(userId, eventId, hash, items);
  res.json({ ok: true });
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
    // unlink löst eine bestehende Lied-Verknüpfung wieder (Punkt bleibt als leerer Text-Eintrag).
    unlink: z.boolean().optional(),
    // responsible: Textfeld der Zuständigen (z.B. „[Musik]"); CT löst Dienst-Tokens selbst auf.
    responsible: z.string().trim().max(1000).optional(),
    // durationMin: Dauer des Punkts in Minuten (0–600); Server rechnet in CT-Sekunden um.
    durationMin: z.coerce.number().int().min(0).max(600).optional(),
    // note: Bemerkung/Beschreibung des Punkts (frei, kann leeren String haben = löschen).
    note: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.arrangementId !== undefined ||
      d.unlink === true ||
      d.responsible !== undefined ||
      d.durationMin !== undefined ||
      d.note !== undefined,
    { message: 'Titel, arrangementId, unlink, responsible, durationMin oder note erforderlich.' },
  );

const createItemSchema = z
  .object({
    type: z.enum(['header', 'text', 'song']),
    title: z.string().trim().max(255).optional(),
    arrangementId: z.coerce.number().int().positive().optional(),
    responsible: z.string().trim().max(1000).optional(),
    note: z.string().max(2000).optional(),
    durationMin: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => d.type !== 'song' || d.arrangementId !== undefined, {
    message: 'Für ein Lied ist arrangementId erforderlich.',
    path: ['arrangementId'],
  });

/** POST /api/services/:eventId/agenda/items – neuen Ablaufpunkt anlegen. */
export async function postAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { type, title, arrangementId, responsible, note, durationMin } = createItemSchema.parse(
    req.body,
  );
  await createAgendaItem(req.ctCookie as string, eventId, {
    type,
    title: title ?? (type === 'header' ? 'Überschrift' : type === 'song' ? 'Lied' : 'Neuer Punkt'),
    arrangementId,
    responsible,
    note,
    durationMin,
  });
  invalidateSongUsageCache(); // Liederzahl/„zuletzt" können sich geändert haben
  res.json({ ok: true });
}

/** GET /api/songs/:songId/arrangements – Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export async function getSongArrangementsCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const song = await getSong(req.ctCookie as string, songId);
  const result: SongArrangementOption[] = (song.arrangements ?? []).map((a) => ({
    arrangementId: a.id,
    arrangementName: a.name,
    key: a.keyOfArrangement ?? a.key ?? null,
  }));
  res.json(result);
}

/** PUT /api/services/:eventId/agenda/items/:itemId – Punkt umbenennen oder mit Lied verknüpfen. */
export async function putAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const { title, arrangementId, unlink, responsible, durationMin, note } = updateItemSchema.parse(
    req.body,
  );
  await updateAgendaItem(req.ctCookie as string, eventId, itemId, {
    // Beim Aufheben der Lied-Verknüpfung den Titel leeren (der Liedtitel soll nicht als Text
    // zurückbleiben) – es sei denn, im selben Request kommt ein neuer Titel mit (Kombi-Speichern
    // aus dem Bearbeiten-Dialog: aufheben + umbenennen in EINEM Schreibvorgang).
    title: unlink ? (title ?? '') : title,
    arrangementId,
    unlink,
    responsible,
    durationMin,
    note,
  });
  invalidateSongUsageCache(); // Verknüpfen/Lösen ändert die Liederzahl/„zuletzt"
  res.json({ ok: true });
}

const hiddenSchema = z.object({ hidden: z.boolean() });

/** PUT /api/services/:eventId/agenda/items/:itemId/hidden – Uhrzeit aus-/einblenden (CT-Auge). */
export async function putAgendaItemHidden(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const { hidden } = hiddenSchema.parse(req.body);
  await setAgendaItemHidden(req.ctCookie as string, eventId, itemId, hidden);
  res.json({ ok: true });
}

/** DELETE /api/services/:eventId/agenda/items/:itemId – einen Ablaufpunkt löschen. */
export async function deleteAgendaItemCtrl(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  await deleteAgendaItem(req.ctCookie as string, eventId, itemId);
  invalidateSongUsageCache(); // entferntes Lied soll aus der Statistik verschwinden
  res.json({ ok: true });
}

/** GET /api/song-library – alle Lieder (Standard-Arrangement) für die „Alle Lieder"-Ansicht. */
export async function getSongLibraryCtrl(req: Request, res: Response): Promise<void> {
  const songs = await getSongLibrary(req.ctCookie as string);
  res.json(songs);
}

/** GET /api/capabilities – was der angemeldete Nutzer laut ChurchTools darf. */
export async function getCapabilitiesCtrl(req: Request, res: Response): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string, req.ctUserId ?? null);
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
  const cookie = req.ctCookie as string;
  const eventId = idSchema.parse(req.params.eventId);
  // Zuletzt gesehenen Stand des Kontos laden → geänderte Punkte markieren (#161). Best effort:
  // ohne Konto-ID/Stand liefern wir ohne Markierungen (kein Fehlalarm bei Erstnutzung).
  let prevSigs: { id: number; sig: string }[] | undefined;
  try {
    const userId = req.ctUserId ?? (await getUserId(cookie));
    prevSigs = (await getSeenSetlists(userId))[String(eventId)]?.items;
  } catch {
    /* Konto-ID/Datei nicht verfügbar → ohne Diff */
  }
  const items = await getAgendaItems(cookie, eventId, prevSigs);
  res.json(items);
}

const createVersionSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Name fehlt').max(60),
  text: z.string().min(1, 'Text fehlt'),
});

/** POST /api/songs/:songId/versions – neue benannte Version anlegen. */
export async function postVersion(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId, name, text } = createVersionSchema.parse(req.body);
  const version = await createVersion(req.ctCookie as string, songId, arrangementId, name, text);
  res.json(version);
}

const updateVersionSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  text: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60).optional(),
});

/** PUT /api/songs/:songId/versions/:versionKey – Version aktualisieren (Text und/oder Name). */
export async function putVersion(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const versionKey = z.string().min(1).parse(req.params.versionKey);
  const { arrangementId, text, name } = updateVersionSchema.parse(req.body);
  const version = await updateVersion(req.ctCookie as string, songId, arrangementId, versionKey, {
    text,
    name,
  });
  res.json(version);
}

/**
 * Nur diese MIME-Typen werden 1:1 (inline) ausgeliefert. Alles andere reicht der Proxy als
 * `application/octet-stream` mit `Content-Disposition: attachment` durch. Hintergrund (#138):
 * Die Bytes kommen aus ChurchTools, wo jeder mit Upload-Recht (Musiker) eine Datei an ein
 * Arrangement hängen kann. Würde der Content-Type ungefiltert übernommen, könnte eine HTML-/JS-
 * Datei auf UNSERER Origin ausgeführt werden (Stored-XSS, umgeht die CSP über `'self'`). Die
 * App braucht nur PDF + Rasterbilder + Klartext. **SVG bewusst NICHT gelistet** – es kann
 * Skripte enthalten und würde als Bild auf der eigenen Origin rendern.
 */
const INLINE_SAFE_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
]);

/** Rein & testbar: entscheidet über Content-Type + ob als Download (attachment) ausgeliefert wird. */
export function sanitizeFileContentType(raw: string): {
  contentType: string;
  attachment: boolean;
} {
  const mime = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (INLINE_SAFE_MIME.has(mime)) return { contentType: raw, attachment: false };
  return { contentType: 'application/octet-stream', attachment: true };
}

/** GET /api/songs/:songId/files/:fileId – Datei (PDF/Bild) aus ChurchTools durchreichen. */
export async function getFile(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const fileId = idSchema.parse(req.params.fileId);
  const cookie = req.ctCookie as string;
  const fileUrl = await resolveFileUrl(cookie, songId, fileId);
  const { buffer, contentType: raw } = await fetchFileBytes(cookie, fileUrl);
  const { contentType, attachment } = sanitizeFileContentType(raw);
  res.setHeader('Content-Type', contentType);
  // nosniff ist global (Helmet) gesetzt; hier zusätzlich, damit ein durchgereichter octet-stream
  // NIE per Content-Sniffing doch als HTML interpretiert wird.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (attachment) res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}

const deleteSchema = z.object({ arrangementId: z.coerce.number().int().positive() });

/** DELETE /api/songs/:songId/versions/:versionKey – benannte Version löschen (Original bleibt). */
export async function deleteVersionCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const versionKey = z.string().min(1).parse(req.params.versionKey);
  const { arrangementId } = deleteSchema.parse(req.body);
  await deleteVersion(req.ctCookie as string, songId, arrangementId, versionKey);
  res.json({ ok: true });
}
