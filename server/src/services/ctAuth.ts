/**
 * Anmelden, Abmelden und „wer bin ich" (#280).
 *
 * Die Anmeldung läuft über das ChurchTools-Session-Cookie: Beim Login holen wir es ab, danach geht es
 * bei jeder Anfrage mit – auch beim Datei-Download über `public/filedownload`, der den
 * `Authorization`-Header nicht annimmt.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { BASE, CtOverloadedError, ctGet, ctSignal, parseRetryAfter } from './ctHttp.js';
import { forgetSession, userIdMemo } from './ctSessionMemos.js';
import { ctId } from '../utils/ctId.js';
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
  // Eine Zeitüberschreitung bleibt hier bewusst eine rohe `TimeoutError` – wie in `ctGet`. Sie
  // wird vom `errorHandler` zu 500 und landet als „Unerwarteter Fehler" im Log, ist also sichtbar;
  // und `isCtOverloaded` erkennt sie genau in dieser Form (#300). Sie hier allein zu einem 504 zu
  // übersetzen wäre eine fünfte Variante derselben Regel statt einer Regel.
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
  // **429 ist eine Drosselung, kein Serverfehler** – die VIERTE Stelle dieser Regel (#381).
  // `ctGet` (#300), der Datei-Download und `ctWrite` (13.08.2026) unterscheiden das; der
  // Anmeldepfad machte daraus einen 502 und damit „am Passwort liegt es nicht" statt „bitte einen
  // Moment warten".
  if (res.status === 429) {
    throw new CtOverloadedError(parseRetryAfter(res.headers.get('retry-after')));
  }
  if (!res.ok) {
    // **Diagnostisch (#381).** Dieser Zweig war stumm: Der `errorHandler` loggt nur
    // nicht-`HttpError`, ein Request-Log gibt es nicht. Ein fehlgeschlagener Login – die häufigste
    // Störung überhaupt – hinterließ damit keine Spur im Container-Log, und der Vorfall vom
    // 03.09.2026 war deshalb nicht aufklärbar. `ctCsrf.ts` hat dieselbe Lehre seit #296.
    console.error(`[churchtools] login → HTTP ${res.status}`);
    throw new HttpError(502, `ChurchTools-Anmeldung fehlgeschlagen (HTTP ${res.status}).`);
  }

  const cookie = extractSessionCookie(res);
  if (!cookie) {
    // Ebenfalls stumm gewesen (#381). Tritt auf, wenn ChurchTools mit 200 antwortet, aber kein
    // `ChurchTools_*`-Cookie mitschickt – ohne diese Zeile ist das von einem echten Serverfehler
    // nicht zu unterscheiden.
    console.error('[churchtools] login → 200, aber kein ChurchTools_*-Cookie in der Antwort');
    throw new HttpError(502, 'Keine Session von ChurchTools erhalten.');
  }

  const user = await whoami(cookie);
  return { cookie, user };
}

/**
 * „Wer bin ich" – **und die Stelle, die eine tote CT-Session als solche erkennt** (#381).
 *
 * ChurchTools antwortet auf `/api/whoami` **ohne gültige Session nicht mit 401**, sondern mit
 * **HTTP 200** und einem Phantom-Nutzer:
 *
 * ```
 * {"data":{"id":-1,"firstName":"","lastName":"Anonymous", …}}
 * ```
 *
 * Gemessen an 3.136.2 (Build 32882) am 03.09.2026. Früher kam hier ein 401 – darauf ist der ganze
 * Ausgesperrt-Schutz gebaut: `getMe` verwirft die Session nur bei 401 (#270), `getCapabilities`
 * führt nur bei 401 zum Login statt in die „Erneut versuchen"-Sackgasse (#149, Bezug #104). Ohne
 * dieses 401 hält die App den Phantom-Nutzer für angemeldet und zeigt „kein Zugriff" – heraus kam
 * man nur durch Löschen der Website-Daten.
 *
 * **Die ID ist das Merkmal, nicht der Name.** `lastName === 'Anonymous'` wäre Anzeigetext und in
 * einer anderen Spracheinstellung ein anderer; eine Person mit `id <= 0` gibt es nicht. Gelesen wird
 * sie mit `ctId` – der vorhandenen Stelle für „ID aus einem unbekannten Wert" (#322): `ctGet<T>`
 * **behauptet** den Typ nur (castet), und die ChurchTools-Schnittstellen liefern IDs teils als
 * Zeichenkette. Eine eigene Zahlenprüfung hier wäre eine zweite Fassung derselben Regel.
 *
 * **Warum hier und nur hier:** `whoami` ist die einzige Stelle im Projekt, die `/api/whoami` ruft.
 * Alle Aufrufer (`getUserId`, `getMe`, Team-Notizen, `getCapabilities`, Anmerkungen, Einstellungen,
 * Setlist) gehen darüber – die Prüfung ein zweites Mal daneben zu stellen wäre genau die
 * Regel-Dopplung, die dieses Projekt am häufigsten getroffen hat.
 *
 * Nebeneffekt, der ebenfalls hier verschwindet: Die `-1` floss über `getUserId` ungeprüft in
 * Dateinamen (`annotations.ts` → `-1.json`, `userSettings.ts` → `settings--1.json`). Zwei
 * verschiedene Menschen mit toter Session wären beide „Konto -1" gewesen – und hätten sich eine
 * Anmerkungs-Datei geteilt.
 */
export async function whoami(cookie: string): Promise<ChurchToolsUser> {
  const me = await ctGet<ChurchToolsUser>(cookie, '/api/whoami');
  const id = ctId(me?.id);
  if (id === null || id <= 0) {
    throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
  }
  return { id, firstName: me.firstName, lastName: me.lastName };
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
 * fünf Minuten lang noch gecachte Rechte geliefert, ohne ChurchTools zu fragen. Welche Speicher das
 * sind, weiß seit #280 `forgetSession` in `ctSessionMemos.ts` – **dort** wird eine neue eingetragen,
 * nicht hier.
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
