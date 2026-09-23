import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/ctAuth.js';

/**
 * Eigene Konto-ID – bevorzugt aus dem signierten Session-Cookie (#149), sonst per whoami (#199).
 * Ohne die Bevorzugung entstand pro Anmerkungs-PUT ein zusätzlicher ChurchTools-Roundtrip, sobald
 * der whoami-Cache kalt war – und die PUTs laufen debounced im Sekundentakt.
 */
async function myUserId(req: Request): Promise<number> {
  return req.ctUserId ?? (await getUserId(ctCookie(req)));
}
import * as store from '../services/annotations.js';
import type { AnnotationText, PageAnnotation } from '@shared/types/index';
import { ANNO_KEY_RE } from '@shared/keys/index';
import { ctCookie } from '../utils/ctCookie.js';
import { songIdsFromQuery } from '../utils/songIdsQuery.js';
import type { GleicheSchluessel } from '../utils/schemaSpiegel.js';

const textSchema = z.object({
  id: z.number(),
  fx: z.number(),
  fy: z.number(),
  text: z.string().max(2000),
  color: z.string().max(20),
  sizeCqh: z.number(),
  // Absatz-Format (optional; ältere Anmerkungen kennen es nicht). MUSS hier stehen, sonst schneidet
  // Zod die Felder beim Speichern weg → beim nächsten Pull fehlt z. B. `bold` und normaler Text
  // wird fälschlich fett dargestellt (Client-Fallback für Bestandstexte).
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const annoSchema = z.object({
  // PNG-DataURL der Striche – Obergrenze als Missbrauchs-Bremse (eine Seite).
  strokes: z.string().max(6_000_000).nullable().optional(),
  texts: z.array(textSchema).max(500).optional(),
  zoom: z.object({ x: z.number(), y: z.number(), scale: z.number() }).nullable().optional(),
});

// Compile-Wächter: Zod-Schema und geteilter Typ PageAnnotation müssen deckungsgleich sein.
// Fehlt hier ein Feld, das der Typ (Client/Server) kennt, schneidet Zod es beim Speichern
// stillschweigend weg (Ursache von #115); umgekehrt fiele ein Zod-Feld auf, das der Typ nicht
// kennt. Zur Laufzeit kostet der Wächter nichts.
//
// ⚠️ Die beiden Zuweisungen allein halten das NICHT: Sie bemerken kein fehlendes OPTIONALES Feld –
// und `bold`, der Anlass für diesen Wächter, ist optional. Nachgestellt am 23.09.2026: `bold` aus
// dem Schema entfernt, Build grün. Die Typprüfung übernehmen deshalb die `GleicheSchluessel`-Zeilen,
// je Ebene eine (die Texte stecken verschachtelt in der Anmerkung).
const _annoZodSubsetOfType = (a: z.infer<typeof annoSchema>): PageAnnotation => a;
const _annoTypeSubsetOfZod = (p: PageAnnotation): z.infer<typeof annoSchema> => p;
void _annoZodSubsetOfType;
void _annoTypeSubsetOfZod;
const _annoSchluessel: GleicheSchluessel<PageAnnotation, z.infer<typeof annoSchema>> = true;
const _textSchluessel: GleicheSchluessel<AnnotationText, z.infer<typeof textSchema>> = true;
void _annoSchluessel;
void _textSchluessel;

// Die Schlüsselform kommt aus @shared/keys (#250) – dieselbe Konstante wie im Client. Vorher stand
// dieselbe Regex hier wortgleich ein zweites Mal; wäre eine der beiden gedriftet, hätte der Server
// gültige Schlüssel abgelehnt und sie wären nie gespeichert worden.
const keySchema = z.string().max(120).regex(ANNO_KEY_RE, 'Ungültiger Anmerkungs-Schlüssel.');

/** GET /api/annotations?songs=1,2,3 – alle Anmerkungen des Kontos zu diesen Liedern. */
export async function getAnnotations(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const songs = songIdsFromQuery(req.query.songs);
  res.json(await store.getAnnotations(userId, songs));
}

/** PUT /api/annotations/:key – Anmerkungen einer Seite aktualisieren (Feld-Merge). */
export async function putAnnotation(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const key = keySchema.parse(req.params.key);
  const partial = annoSchema.parse(req.body);
  await store.putAnnotation(userId, key, partial);
  res.json({ ok: true });
}

/** DELETE /api/annotations/:key – Anmerkungen einer Seite löschen. */
export async function deleteAnnotation(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  const key = keySchema.parse(req.params.key);
  await store.deleteAnnotation(userId, key);
  res.json({ ok: true });
}
