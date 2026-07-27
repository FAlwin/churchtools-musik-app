import type { Request } from 'express';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Das ChurchTools-Session-Cookie der laufenden Anfrage (#198).
 *
 * Warum ein Helfer: `req.ctCookie` ist im Typ **optional** (die Middleware setzt es erst), deshalb
 * stand an 29 Stellen ein `req.ctCookie as string`. Diese Zusicherung ist still: Würde eine Route je
 * ohne `requireSession` gemountet, schwiege TypeScript und der Service bekäme `undefined` in einen
 * `Cookie:`-Header – die Anfrage liefe unangemeldet weiter, statt sauber abzubrechen.
 *
 * Hier ist dieselbe Stelle eine echte Prüfung: kein Cookie → 401, wie es der Client erwartet.
 */
export function ctCookie(req: Request): string {
  const cookie = req.ctCookie;
  if (!cookie) throw new HttpError(401, 'Nicht angemeldet.');
  return cookie;
}
