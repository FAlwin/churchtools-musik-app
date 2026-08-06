/**
 * Anmelden, Abmelden und „wer bin ich" (#280).
 *
 * Die Anmeldung läuft über das ChurchTools-Session-Cookie: Beim Login holen wir es ab, danach geht es
 * bei jeder Anfrage mit – auch beim Datei-Download über `public/filedownload`, der den
 * `Authorization`-Header nicht annimmt.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { BASE, ctGet, ctSignal } from './ctHttp.js';
import { forgetSession, userIdMemo } from './ctSessionMemos.js';
import type { ChurchToolsUser } from './ctTypes.js';

/** Liest aus den Set-Cookie-Headern das ChurchTools-Session-Cookie (name=value). */
export function extractSessionCookie(res: Response): string | null {
  // Node 18+/undici: getSetCookie() liefert alle Set-Cookie-Header einzeln
  const cookies =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const c of cookies) {
    const match = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Meldet einen Nutzer bei ChurchTools an und gibt das Session-Cookie + Userinfo zurück.
 * Wirft HttpError(401) bei falschen Zugangsdaten.
 */
export async function login(
  username: string,
  password: string,
): Promise<{ cookie: string; user: ChurchToolsUser }> {
  const res = await fetch(`${BASE}/api/login`, {
    signal: ctSignal(),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // ChurchTools antwortet bei falschen Zugangsdaten mit 400 (auch 401/403 möglich)
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'E-Mail oder Passwort falsch.');
  }
  if (!res.ok) {
    throw new HttpError(502, 'ChurchTools-Anmeldung fehlgeschlagen.');
  }

  const cookie = extractSessionCookie(res);
  if (!cookie) {
    throw new HttpError(502, 'Keine Session von ChurchTools erhalten.');
  }

  const user = await whoami(cookie);
  return { cookie, user };
}

export async function whoami(cookie: string): Promise<ChurchToolsUser> {
  const me = await ctGet<ChurchToolsUser>(cookie, '/api/whoami');
  return { id: me.id, firstName: me.firstName, lastName: me.lastName };
}

/** Liefert die ChurchTools-Person-ID zum Session-Cookie (gecacht). */
export async function getUserId(cookie: string): Promise<number> {
  const hit = userIdMemo.get(cookie);
  if (hit !== undefined) return hit;
  const me = await whoami(cookie);
  userIdMemo.set(cookie, me.id);
  return me.id;
}

/**
 * Beendet die ChurchTools-Session serverseitig (best effort). Ohne diesen Aufruf bliebe die
 * CT-Session nach dem App-Logout bis zu ihrem eigenen Ablauf gültig – ein je abgegriffenes
 * Cookie wäre trotz „Abmelden" weiter nutzbar. Fehler werden bewusst geschluckt (der Logout in
 * der App soll auch klappen, wenn ChurchTools gerade nicht erreichbar ist); die Cache-Einträge
 * zum Cookie werden in jedem Fall entfernt.
 *
 * **ALLE cookie-basierten Speicher, nicht nur einer.** Vorher stand hier allein `userIdCache` – die
 * beiden anderen (Rechte, CSRF-Token) hängen am selben Cookie und blieben nach dem Abmelden stehen.
 * Genau die Fehlerklasse „die Regel gilt für A, B, C, C fehlt": Ein abgemeldetes Cookie hätte bis zu
 * fünf Minuten lang noch gecachte Rechte geliefert, ohne ChurchTools zu fragen. Kommt eine vierte
 * Sitzungs-Ablage dazu, gehört sie **hierhin**.
 */
export async function logout(cookie: string): Promise<void> {
  forgetSession(cookie);
  try {
    await fetch(`${BASE}/api/logout`, {
      signal: ctSignal(),
      method: 'POST',
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
  } catch {
    /* ChurchTools nicht erreichbar → App-Logout trotzdem durchziehen */
  }
}
