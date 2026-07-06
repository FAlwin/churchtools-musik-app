import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler.js';
import { config } from '../config.js';
import { getCapabilities } from '../services/churchtools.js';

const COOKIE_NAME = 'ct_session';
// Sitzungsdauer des App-Cookies. Rollierend: bei jeder Nutzung (requireSession) neu gesetzt,
// sodass regelmäßige Nutzer praktisch angemeldet bleiben; nur nach 30 Tagen ohne Nutzung fällt
// die Anmeldung weg. (Die ChurchTools-Sitzung dahinter kann CT unabhängig früher beenden.)
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage

/** Express-Request um das ChurchTools-Session-Cookie erweitern. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctCookie?: string;
    }
  }
}

/**
 * Speichert das ChurchTools-Session-Cookie signiert + httpOnly im Client-Cookie.
 * `secure` ist standardmäßig AUS (LAN-HTTP-Betrieb, sonst speichert der Browser das Cookie
 * nicht). Wer ausschließlich über HTTPS läuft (Reverse Proxy/Cloudflare), setzt `COOKIE_SECURE=true`
 * und erhält damit die strengere Variante. httpOnly + signiert + SameSite=Lax bleiben immer aktiv.
 */
export function setSession(res: Response, churchToolsCookie: string): void {
  res.cookie(COOKIE_NAME, churchToolsCookie, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    signed: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Middleware: stellt sicher, dass eine gültige Session vorliegt, und hängt sie an req.ctCookie.
 * Verlängert das Cookie rollierend bei jeder authentifizierten Anfrage (gleitendes Ablaufdatum).
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const cookie = req.signedCookies?.[COOKIE_NAME];
  if (!cookie || typeof cookie !== 'string') {
    throw new HttpError(401, 'Nicht angemeldet.');
  }
  req.ctCookie = cookie;
  setSession(res, cookie); // rollierend: Ablaufdatum bei jeder Nutzung neu setzen
  next();
}

/**
 * Middleware (nach requireSession): nur ChurchTools-Administratoren dürfen weiter.
 * Schützt das Schreiben der Branding-Einstellungen.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string);
  if (!caps.isAdmin) {
    throw new HttpError(403, 'Nur Administratoren dürfen die Einstellungen ändern.');
  }
  next();
}
