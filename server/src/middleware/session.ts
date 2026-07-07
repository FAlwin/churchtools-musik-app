import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler.js';
import { config } from '../config.js';
import { getCapabilities } from '../services/churchtools.js';

const COOKIE_NAME = 'ct_session';
// Sitzungsdauer des App-Cookies. Rollierend: bei jeder Nutzung (requireSession) neu gesetzt,
// sodass regelmäßige Nutzer praktisch angemeldet bleiben; nur nach 30 Tagen ohne Nutzung fällt
// die Anmeldung weg. (Die ChurchTools-Sitzung dahinter kann CT unabhängig früher beenden.)
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage
// Absolute Obergrenze: das Rollieren verlängert NICHT unbegrenzt – spätestens 90 Tage nach dem
// Login ist eine Neuanmeldung fällig. Sonst bliebe ein einmal abgegriffenes Cookie bei
// regelmäßiger Nutzung beliebig lange gültig.
const SESSION_ABSOLUTE_MAX_MS = 1000 * 60 * 60 * 24 * 90; // 90 Tage

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
 * Cookie-Wert = `<Login-Zeitstempel-ms>|<ChurchTools-Cookie>`. Der Zeitstempel entsteht beim
 * Login und wird beim Rollieren UNVERÄNDERT weitergetragen → die absolute Obergrenze bleibt
 * prüfbar. Alte Cookies (reines CT-Cookie, vor diesem Update gesetzt) werden akzeptiert und
 * beim nächsten Rollieren mit „jetzt" gestempelt – niemand wird durch das Update ausgeloggt.
 */
export function parseSessionValue(
  raw: string,
  now = Date.now(),
): { ctCookie: string; issuedAt: number } {
  const m = raw.match(/^(\d{10,})\|([\s\S]+)$/);
  if (m) return { ctCookie: m[2], issuedAt: Number(m[1]) };
  return { ctCookie: raw, issuedAt: now }; // Altformat → Lebensdauer zählt ab jetzt
}

/** True, wenn die Session ihre absolute Lebensdauer (90 Tage seit Login) überschritten hat. */
export function isSessionExpired(issuedAt: number, now = Date.now()): boolean {
  return now - issuedAt > SESSION_ABSOLUTE_MAX_MS;
}

/** Liest das signierte Session-Cookie aus dem Request (oder null, wenn keins/ungültig). */
export function readSession(req: Request): { ctCookie: string; issuedAt: number } | null {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (!raw || typeof raw !== 'string') return null;
  return parseSessionValue(raw);
}

/**
 * Speichert das ChurchTools-Session-Cookie signiert + httpOnly im Client-Cookie.
 * `secure` ist standardmäßig AUS (LAN-HTTP-Betrieb, sonst speichert der Browser das Cookie
 * nicht). Wer ausschließlich über HTTPS läuft (Reverse Proxy/Cloudflare), setzt `COOKIE_SECURE=true`
 * und erhält damit die strengere Variante. httpOnly + signiert + SameSite=Lax bleiben immer aktiv.
 */
export function setSession(res: Response, churchToolsCookie: string, issuedAt = Date.now()): void {
  res.cookie(COOKIE_NAME, `${issuedAt}|${churchToolsCookie}`, {
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
 * Verlängert das Cookie rollierend bei jeder authentifizierten Anfrage (gleitendes Ablaufdatum),
 * trägt dabei aber den Login-Zeitstempel weiter → nach 90 Tagen ist endgültig Schluss.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const session = readSession(req);
  if (!session) {
    throw new HttpError(401, 'Nicht angemeldet.');
  }
  if (isSessionExpired(session.issuedAt)) {
    clearSession(res);
    throw new HttpError(401, 'Sitzung abgelaufen. Bitte neu anmelden.');
  }
  req.ctCookie = session.ctCookie;
  setSession(res, session.ctCookie, session.issuedAt); // rollierend, Zeitstempel bleibt
  next();
}

/**
 * Middleware (nach requireSession): nur ChurchTools-Administratoren dürfen weiter.
 * Schützt das Schreiben der Branding-Einstellungen.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const caps = await getCapabilities(req.ctCookie as string);
  if (!caps.isAdmin) {
    throw new HttpError(403, 'Nur Administratoren dürfen die Einstellungen ändern.');
  }
  next();
}
