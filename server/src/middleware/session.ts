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

/** Express-Request um das ChurchTools-Session-Cookie (+ Konto-ID) erweitern. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctCookie?: string;
      /** ChurchTools-Person-ID aus dem Session-Cookie (seit #149); null bei Alt-Cookies. */
      ctUserId?: number | null;
    }
  }
}

/**
 * Cookie-Wert = `<Login-Zeitstempel-ms>|u<userId>|<ChurchTools-Cookie>`. Der Zeitstempel entsteht
 * beim Login und wird beim Rollieren UNVERÄNDERT weitergetragen → die absolute Obergrenze bleibt
 * prüfbar. Die Konto-ID wandert seit #149 mit in den signierten Wert: Der Rechte-Cache kann damit
 * auch überbrücken, wenn ChurchTools' `whoami` während eines Aussetzers nicht antwortet. Ältere
 * Formate (`<ts>|<ct-cookie>` bzw. reines CT-Cookie) werden weiter akzeptiert – niemand wird durch
 * ein Update ausgeloggt; die Konto-ID ist dann bis zum nächsten Login unbekannt (null).
 */
export function parseSessionValue(
  raw: string,
  now = Date.now(),
): { ctCookie: string; issuedAt: number; userId: number | null } {
  const withId = raw.match(/^(\d{10,})\|u(\d+)\|([\s\S]+)$/);
  if (withId) return { ctCookie: withId[3], issuedAt: Number(withId[1]), userId: Number(withId[2]) };
  const m = raw.match(/^(\d{10,})\|([\s\S]+)$/);
  if (m) return { ctCookie: m[2], issuedAt: Number(m[1]), userId: null };
  return { ctCookie: raw, issuedAt: now, userId: null }; // Altformat → Lebensdauer zählt ab jetzt
}

/** True, wenn die Session ihre absolute Lebensdauer (90 Tage seit Login) überschritten hat. */
export function isSessionExpired(issuedAt: number, now = Date.now()): boolean {
  return now - issuedAt > SESSION_ABSOLUTE_MAX_MS;
}

/** Liest das signierte Session-Cookie aus dem Request (oder null, wenn keins/ungültig). */
export function readSession(
  req: Request,
): { ctCookie: string; issuedAt: number; userId: number | null } | null {
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
export function setSession(
  res: Response,
  churchToolsCookie: string,
  issuedAt = Date.now(),
  userId: number | null = null,
): void {
  const idPart = userId != null ? `u${userId}|` : '';
  res.cookie(COOKIE_NAME, `${issuedAt}|${idPart}${churchToolsCookie}`, {
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
  req.ctUserId = session.userId;
  // rollierend; Zeitstempel UND Konto-ID bleiben erhalten
  setSession(res, session.ctCookie, session.issuedAt, session.userId);
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
  const caps = await getCapabilities(req.ctCookie as string, req.ctUserId ?? null);
  if (!caps.isAdmin) {
    throw new HttpError(403, 'Nur Administratoren dürfen die Einstellungen ändern.');
  }
  next();
}
