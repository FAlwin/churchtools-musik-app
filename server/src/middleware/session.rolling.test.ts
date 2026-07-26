/**
 * Wachtest (#152): `requireSession` verlängert das Cookie rollierend und muss dabei den
 * Login-Zeitstempel UND die Konto-ID weitertragen. Ginge die ID beim Rollieren verloren, müssten
 * Anmerkungen/Team-Notizen die ID wieder per whoami holen – genau das, was #149 abgeschafft hat
 * (Rechte-Cache überbrückt CT-Aussetzer nur mit bekannter Konto-ID).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireSession, setSession } from './session.js';

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
    // rollierend neu gesetzt: Zeitstempel UND Konto-ID bleiben im Wert erhalten
    const written = cookie.mock.calls[0]?.[1] as string;
    expect(written).toBe(`${issuedAt}|u42|${CT_COOKIE}`);
  });

  it('Altformat ohne Konto-ID bleibt nutzbar (ctUserId = null)', () => {
    const issuedAt = Date.now() - 60_000;
    const req = reqWith(`${issuedAt}|${CT_COOKIE}`);
    const { res, cookie } = resSpy();

    requireSession(req, res, vi.fn() as unknown as NextFunction);

    expect(req.ctCookie).toBe(CT_COOKIE);
    expect(req.ctUserId).toBeNull();
    expect(cookie.mock.calls[0]?.[1]).toBe(`${issuedAt}|${CT_COOKIE}`);
  });

  it('setSession schreibt die Konto-ID im erwarteten Format', () => {
    const { res, cookie } = resSpy();
    setSession(res, CT_COOKIE, 1_750_000_000_000, 7);
    expect(cookie.mock.calls[0]?.[1]).toBe(`1750000000000|u7|${CT_COOKIE}`);
  });

  it('ohne Anmeldung wirft requireSession 401', () => {
    const req = { signedCookies: {} } as unknown as Request;
    expect(() =>
      requireSession(req, resSpy().res, vi.fn() as unknown as NextFunction),
    ).toThrowError();
  });
});
