import type { NextFunction, Request, Response } from 'express';

/**
 * **Warnung: HTTPS erkannt, aber `COOKIE_SECURE` fehlt** (#409, Code-Check 23.09.2026).
 *
 * `COOKIE_SECURE` steht standardmäßig auf `false`, damit die App im LAN auch per HTTP läuft. Eine
 * Gemeinde, die sie über HTTPS betreibt und die Variable nicht setzt, bekommt ein Sitzungs-Cookie
 * **ohne** `secure` – und nichts weist sie darauf hin. Für die ECG ist die Variable gesetzt; betroffen
 * sind Fremdinstallationen. Ein stiller Fehlbetrieb ist hier der teuerste, weil ihn niemand bemerkt.
 *
 * Deshalb **eine** Zeile ins Container-Log, beim ersten solchen Aufruf – nicht bei jedem: Eine
 * Warnung, die ständig kommt, wird überlesen. Kein Abbruch, HTTP-Betrieb im LAN bleibt erlaubt.
 *
 * Gelesen wird der Kopf `X-Forwarded-Proto` **direkt**, nicht über `req.secure`: Das hängt an
 * `trust proxy` (bei uns `loopback`), und bei einer fremden Proxy-Anordnung würde die Warnung genau
 * dort ausbleiben, wo sie gebraucht wird. Ein gefälschter Kopf bewirkt nur diese eine Logzeile –
 * er entscheidet über nichts.
 */
export function sollteCookieWarnen(p: {
  produktion: boolean;
  cookieSecure: boolean;
  forwardedProto: string | undefined;
  secure: boolean;
}): boolean {
  if (!p.produktion || p.cookieSecure) return false;
  const proto = (p.forwardedProto ?? '').split(',')[0].trim().toLowerCase();
  return p.secure || proto === 'https';
}

export const COOKIE_WARNUNG =
  '⚠️ Die App wird über HTTPS aufgerufen, aber COOKIE_SECURE ist nicht gesetzt – das Sitzungs-Cookie ' +
  'geht ohne „secure"-Flag. In der Compose-Datei bzw. .env COOKIE_SECURE=true setzen und den ' +
  'Container neu erstellen (siehe INSTALL.md, „Externer Zugriff").';

/** Die Middleware: prüft jede Anfrage, meldet aber höchstens einmal je Prozess. */
export function cookieSecureWarnung(einstellung: { produktion: boolean; cookieSecure: boolean }) {
  let gewarnt = false;
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (
      !gewarnt &&
      sollteCookieWarnen({
        ...einstellung,
        forwardedProto: req.get('x-forwarded-proto'),
        secure: req.secure,
      })
    ) {
      gewarnt = true;
      console.warn(COOKIE_WARNUNG);
    }
    next();
  };
}
