/**
 * Wachtest (#152): `requireSession` verlängert das Cookie rollierend und muss dabei den
 * Login-Zeitstempel UND die Konto-ID weitertragen. Ginge die ID beim Rollieren verloren, müssten
 * Anmerkungen/Team-Notizen die ID wieder per whoami holen – genau das, was #149 abgeschafft hat
 * (Rechte-Cache überbrückt CT-Aussetzer nur mit bekannter Konto-ID).
 *
 * ⚠️ Seit #194 ist der CT-Anteil im Cookie **verschlüsselt**. Die Prüfungen hängen deshalb nicht mehr
 * am rohen Cookie-String (der bei jedem Setzen anders aussieht), sondern am **Rückweg** über
 * `readSession` – also an der Absicht: Zeitstempel und Konto-ID müssen erhalten bleiben. Das ist
 * ohnehin die bessere Prüfung; sie überlebt die nächste Formatänderung.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireSession, setSession, readSession } from './session.js';

const CT_COOKIE = 'ChurchTools_abc=xyz123';

/** Request mit signiertem Session-Cookie, wie Express es nach cookieParser liefert. */
function reqWith(value: string): Request {
  return { signedCookies: { ct_session: value } } as unknown as Request;
}

function resSpy(): { res: Response; cookie: ReturnType<typeof vi.fn> } {
  const cookie = vi.fn();
  return { res: { cookie, clearCookie: vi.fn() } as unknown as Response, cookie };
}

describe('requireSession – Rollieren trägt userId weiter (#152)', () => {
  it('hängt ctCookie + ctUserId an den Request und schreibt beides zurück', () => {
    const issuedAt = Date.now() - 60_000;
    const req = reqWith(`${issuedAt}|u42|${CT_COOKIE}`);
    const { res, cookie } = resSpy();
    const next = vi.fn() as unknown as NextFunction;

    requireSession(req, res, next);

    expect(req.ctCookie).toBe(CT_COOKIE);
    expect(req.ctUserId).toBe(42);
    expect(next).toHaveBeenCalled();
    // rollierend neu gesetzt: Zeitstempel UND Konto-ID bleiben erhalten (über den Rückweg geprüft,
    // weil der Wert seit #194 verschlüsselt ist)
    const written = cookie.mock.calls[0]?.[1] as string;
    const wieder = readSession(reqWith(written));
    expect(wieder).toEqual({ ctCookie: CT_COOKIE, issuedAt, userId: 42 });
    expect(written).not.toContain(CT_COOKIE); // nicht im Klartext (#194)
  });

  it('Altformat ohne Konto-ID bleibt nutzbar (ctUserId = null)', () => {
    const issuedAt = Date.now() - 60_000;
    const req = reqWith(`${issuedAt}|${CT_COOKIE}`);
    const { res, cookie } = resSpy();

    requireSession(req, res, vi.fn());

    expect(req.ctCookie).toBe(CT_COOKIE);
    expect(req.ctUserId).toBeNull();
    // Das Altformat wird gelesen – zurückgeschrieben wird aber schon verschlüsselt (#194), sodass
    // Bestandscookies bei der ersten Nutzung von selbst nachziehen.
    const written = cookie.mock.calls[0]?.[1] as string;
    expect(readSession(reqWith(written))).toEqual({
      ctCookie: CT_COOKIE,
      issuedAt,
      userId: null,
    });
    expect(written).not.toContain(CT_COOKIE);
  });

  it('setSession schreibt Zeitstempel und Konto-ID lesbar, das CT-Cookie aber nicht', () => {
    const { res, cookie } = resSpy();
    setSession(res, CT_COOKIE, 1_750_000_000_000, 7);
    const written = cookie.mock.calls[0]?.[1] as string;
    // Zeitstempel + ID müssen im Klartext bleiben: daran hängen Ablauf-Prüfung und Rechte-Cache.
    expect(written.startsWith('1750000000000|u7|')).toBe(true);
    expect(written).not.toContain(CT_COOKIE);
  });

  it('ohne Anmeldung wirft requireSession 401', () => {
    const req = { signedCookies: {} } as unknown as Request;
    expect(() =>
      requireSession(req, resSpy().res, vi.fn() as unknown as NextFunction),
    ).toThrowError();
  });
});
