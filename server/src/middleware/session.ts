import type { Request, Response, NextFunction } from 'express';
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { HttpError } from './errorHandler.js';
import { config } from '../config.js';
import { getCapabilities } from '../services/churchtools.js';
import { ctCookie } from '../utils/ctCookie.js';

const COOKIE_NAME = 'ct_session';
// Sitzungsdauer des App-Cookies. Rollierend: bei jeder Nutzung (requireSession) neu gesetzt,
// sodass regelmäßige Nutzer praktisch angemeldet bleiben; nur nach 30 Tagen ohne Nutzung fällt
// die Anmeldung weg. (Die ChurchTools-Sitzung dahinter kann CT unabhängig früher beenden.)
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage
// Absolute Obergrenze: das Rollieren verlängert NICHT unbegrenzt – spätestens 90 Tage nach dem
// Login ist eine Neuanmeldung fällig. Sonst bliebe ein einmal abgegriffenes Cookie bei
// regelmäßiger Nutzung beliebig lange gültig.
const SESSION_ABSOLUTE_MAX_MS = 1000 * 60 * 60 * 24 * 90; // 90 Tage

/**
 * Verschlüsselung des ChurchTools-Cookie-Anteils im App-Cookie (#194).
 *
 * Das App-Cookie ist signiert und `httpOnly`, war aber **nicht verschlüsselt**: Wer es je in die Hände
 * bekam (Backup, Proxy-Log, kompromittiertes oder verlorenes Gerät), konnte daraus das rohe
 * ChurchTools-Cookie herauslesen und damit **direkt gegen ChurchTools** arbeiten – also deutlich mehr,
 * als die App selbst erlaubt. Verschlüsselt geht das nicht mehr ohne den Server-Schlüssel.
 *
 * Bewusst KEIN server-seitiger Sitzungs-Speicher: Das Cookie bleibt selbsttragend, es gibt also keine
 * Sitzungsdatei auf dem Volume (die in jedes Backup wanderte) und niemand wird bei einem Deploy
 * abgemeldet.
 *
 * Der Schlüssel wird per HKDF aus `SESSION_SECRET` abgeleitet – mit eigenem `info`-Label, damit er
 * nicht derselbe ist, mit dem `cookie-parser` signiert.
 */
const ENC_PREFIX = 'e1:';
const encKey = Buffer.from(hkdfSync('sha256', config.sessionSecret, '', 'ct-session-enc-v1', 32));

function encryptCtCookie(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ENC_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/**
 * Entschlüsselt den Cookie-Anteil. Bestandsformate (unverschlüsselt) werden **unverändert
 * durchgereicht** – niemand wird durch das Update abgemeldet; beim nächsten Rollieren
 * (`requireSession`) landet das Cookie automatisch verschlüsselt beim Browser.
 *
 * `null` bedeutet: sah verschlüsselt aus, ließ sich aber nicht entschlüsseln (fremder/rotierter
 * Schlüssel, manipuliert) → wie „keine Session" behandeln.
 */
function decryptCtCookie(value: string): string | null {
  if (!value.startsWith(ENC_PREFIX)) return value; // Altformat
  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const body = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Middleware: ein **unbrauchbares** Session-Cookie einmal aktiv löschen (#268, #281).
 *
 * Es gibt DREI Wege, auf denen das Cookie unlesbar wird – alle entstehen erst mit #194:
 *  - die Signatur passt nicht mehr → `cookie-parser` legt `false` in `req.signedCookies` ab
 *    (z. B. weil `SESSION_SECRET` gewechselt hat);
 *  - die Signatur passt, aber der verschlüsselte CT-Anteil lässt sich nicht entschlüsseln;
 *  - das Cookie ist gar nicht signiert (kein `s:`-Präfix) → `cookie-parser` legt es NUR in
 *    `req.cookies` ab, NICHT in `req.signedCookies`. **Genau dieser Fall fehlte in #268** (#281):
 *    Die alte Bedingung sah nur `signedCookies` und ließ das Cookie liegen.
 *
 * Ohne das Löschen behandelten alle Stellen es wie „nicht angemeldet" – aber der Browser sendet es
 * bei JEDER weiteren Anfrage wieder mit; die App bleibt in einem Zwischenzustand, aus dem nur Ab- und
 * Neuanmelden hilft. Kein Auth-Bypass (`readSession` liest ausschließlich `signedCookies`), aber
 * unnötiger Ballast bis zu 30 Tage.
 *
 * Bewusst **eine** Stelle für alle Routen (statt in `getMe` und `requireSession` je einmal) – sonst
 * wäre es die nächste halb umgesetzte Regel. Mountet direkt nach `cookieParser`; dass ein
 * anschließender Login sein frisches Cookie trotzdem setzt (zweiter `Set-Cookie` im selben Antwort-
 * kopf gewinnt), hält der E2E-Test im echten Browser fest.
 */
export function dropUnusableSessionCookie(req: Request, res: Response, next: NextFunction): void {
  // Vorhanden (egal ob in `signedCookies` mit `false`/Wert, oder nur in `cookies` beim unsignierten
  // Cookie) UND nicht lesbar → löschen. `undefined` an BEIDEN Stellen heißt: gar kein Cookie dabei.
  const present =
    req.signedCookies?.[COOKIE_NAME] !== undefined || req.cookies?.[COOKIE_NAME] !== undefined;
  if (present && readSession(req) === null) {
    clearSession(res);
  }
  next();
}

/**
 * Stabiler Rate-Limit-Schlüssel einer Sitzung – oder `null`, wenn keine vorliegt (#194/N1).
 *
 * ZWEI Gründe, das nicht mehr am rohen Cookie-Wert zu machen:
 *  1. Seit der Verschlüsselung enthält das Cookie bei **jeder** Anfrage einen neuen Zufallswert (IV).
 *     Der rohe Wert als Schlüssel hätte das Limit still wirkungslos gemacht – jede Anfrage wäre ein
 *     neuer „Nutzer" gewesen.
 *  2. Der rohe Wert lag als Map-Key im Limiter-Speicher, also eine weitere Kopie des Geheimnisses.
 *
 * Bevorzugt die Konto-ID; nur bei Alt-Cookies ohne ID ein sha256-Fingerprint (nie das Cookie selbst) –
 * dieselbe Ableitung wie beim Ablauf-Fingerabdruck in `setlistController`.
 */
export function sessionRateKey(req: Request): string | null {
  const session = readSession(req);
  if (!session) return null;
  if (session.userId != null) return `u${session.userId}`;
  return `c${createHash('sha256').update(session.ctCookie).digest('hex').slice(0, 16)}`;
}

/** Nur für Tests: prüfen, dass ein Wert wirklich verschlüsselt ist (und nicht im Klartext liegt). */
export function isEncryptedCtCookie(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

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
  if (withId)
    return { ctCookie: withId[3], issuedAt: Number(withId[1]), userId: Number(withId[2]) };
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
  // Bewusst `unknown`: `signedCookies` ist untypisiert (`any`) – der Guard darunter macht daraus
  // einen String, statt das `any` weiterzureichen (#279).
  const raw: unknown = req.signedCookies?.[COOKIE_NAME];
  if (!raw || typeof raw !== 'string') return null;
  const parsed = parseSessionValue(raw);
  // `parseSessionValue` zerlegt nur (rein und ohne Schlüssel); entschlüsselt wird hier (#194).
  const ctCookie = decryptCtCookie(parsed.ctCookie);
  if (ctCookie === null) return null; // sah verschlüsselt aus, passt aber nicht → wie keine Session
  return { ...parsed, ctCookie };
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
  // Der CT-Anteil wird verschlüsselt (#194) – im Cookie steht danach kein nutzbares CT-Cookie mehr.
  res.cookie(COOKIE_NAME, `${issuedAt}|${idPart}${encryptCtCookie(churchToolsCookie)}`, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    signed: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  // Attribute des Setzens spiegeln (#199): Browser matchen zwar auf Name+Path, aber so bleibt
  // Setzen/Löschen deckungsgleich, falls sich die Regeln je verschärfen.
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  });
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
  const caps = await getCapabilities(ctCookie(req), req.ctUserId ?? null);
  if (!caps.isAdmin) {
    throw new HttpError(403, 'Nur Administratoren dürfen die Einstellungen ändern.');
  }
  next();
}
