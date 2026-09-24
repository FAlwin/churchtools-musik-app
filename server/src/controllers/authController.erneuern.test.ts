import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { readSession, setSession } from '../middleware/session.js';

/**
 * **Angemeldet bleiben über den Anmelde-Schlüssel** (Alwin, 23.09.2026: „Warum muss man sich nach
 * jedem neuen Update auf der Prod neu anmelden?").
 *
 * Die App bewahrte nur die ChurchTools-Sitzung auf; beendete ChurchTools sie, zeigte die App den
 * Login – unsere 30 Tage halfen nichts. Jetzt holt `getMe` mit dem persönlichen Schlüssel still eine
 * neue. Geprüft werden die vier Wege, und vor allem die Regel „vorübergehend ist nicht ungültig":
 * Nur ein UNGÜLTIGER Schlüssel meldet ab, ein ChurchTools-Aussetzer beim Erneuern nicht.
 */
vi.mock('../services/ctAuth.js', () => ({
  whoami: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  holeAnmeldeSchluessel: vi.fn(),
  sitzungAusSchluessel: vi.fn(),
}));

const ct = await import('../services/ctAuth.js');
const { getMe, postLogin } = await import('./authController.js');

const TOKEN = 'T'.repeat(40) + 'persoenlich';
const ALT = 'ChurchToolsV2_ct_x=alt';
const NEU = 'ChurchToolsV2_ct_x=neu';
const ANGEMELDET_SEIT = Date.now() - 5 * 86_400_000;
const USER = { id: 42, firstName: 'Alwin', lastName: 'F' };

/** Ein Cookie-Wert, wie der Browser ihn hält – über `setSession` gebaut, also verschlüsselt. */
function cookieWert(loginToken: string | null): string {
  const cookie = vi.fn();
  setSession({ cookie } as unknown as Response, {
    ctCookie: ALT,
    issuedAt: ANGEMELDET_SEIT,
    userId: 42,
    loginToken,
  });
  return String(cookie.mock.calls[0][1]);
}

function reqRes(wert: string) {
  const json = vi.fn();
  const clearCookie = vi.fn();
  const cookie = vi.fn();
  return {
    req: { signedCookies: { ct_session: wert } } as unknown as Request,
    res: { json, clearCookie, cookie } as unknown as Response,
    json,
    clearCookie,
    cookie,
  };
}
const gesetzteSitzung = (cookie: ReturnType<typeof vi.fn>) =>
  readSession({
    signedCookies: { ct_session: String(cookie.mock.calls.at(-1)?.[1]) },
  } as unknown as Request);

beforeEach(() => {
  vi.mocked(ct.whoami).mockRejectedValue(new HttpError(401, 'Session abgelaufen.'));
});

describe('getMe – ChurchTools hat die Sitzung beendet', () => {
  it('holt mit dem Schlüssel still eine neue – Login-Zeitpunkt und Schlüssel bleiben', async () => {
    vi.mocked(ct.sitzungAusSchluessel).mockResolvedValue({ cookie: NEU, user: USER });
    const { req, res, json, clearCookie, cookie } = reqRes(cookieWert(TOKEN));

    await getMe(req, res);

    expect(ct.sitzungAusSchluessel).toHaveBeenCalledWith(TOKEN);
    expect(json).toHaveBeenCalledWith({ authenticated: true, user: USER });
    expect(clearCookie).not.toHaveBeenCalled();
    expect(gesetzteSitzung(cookie)).toEqual({
      ctCookie: NEU,
      issuedAt: ANGEMELDET_SEIT, // die 90-Tage-Grenze verschiebt sich NICHT
      userId: 42,
      loginToken: TOKEN,
    });
  });

  it('meldet ab, wenn der Schlüssel nicht mehr gilt', async () => {
    vi.mocked(ct.sitzungAusSchluessel).mockRejectedValue(new HttpError(401, 'Schlüssel ungültig.'));
    const { req, res, json, clearCookie } = reqRes(cookieWert(TOKEN));

    await getMe(req, res);

    expect(clearCookie).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ authenticated: false });
  });

  it('behält die Anmeldung, wenn ChurchTools beim Erneuern nur gerade nicht antwortet', async () => {
    vi.mocked(ct.sitzungAusSchluessel).mockRejectedValue(new HttpError(504, 'Zeitüberschreitung.'));
    const { req, res, clearCookie } = reqRes(cookieWert(TOKEN));

    await expect(getMe(req, res)).rejects.toMatchObject({ status: 504 });
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('ohne Schlüssel bleibt es beim alten Verhalten: abmelden', async () => {
    const { req, res, json, clearCookie } = reqRes(cookieWert(null));

    await getMe(req, res);

    expect(ct.sitzungAusSchluessel).not.toHaveBeenCalled();
    expect(clearCookie).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ authenticated: false });
  });
});

describe('postLogin – nimmt den Schlüssel mit', () => {
  function loginReqRes() {
    const cookie = vi.fn();
    const json = vi.fn();
    return {
      req: { body: { email: 'a@b.de', password: 'x' } } as unknown as Request,
      res: { cookie, json } as unknown as Response,
      cookie,
      json,
    };
  }

  it('legt den abgerufenen Schlüssel verschlüsselt ins Cookie', async () => {
    vi.mocked(ct.login).mockResolvedValue({ cookie: ALT, user: USER });
    vi.mocked(ct.holeAnmeldeSchluessel).mockResolvedValue(TOKEN);
    const { req, res, cookie } = loginReqRes();

    await postLogin(req, res);

    expect(ct.holeAnmeldeSchluessel).toHaveBeenCalledWith(ALT, 42);
    expect(String(cookie.mock.calls[0][1])).not.toContain(TOKEN);
    expect(gesetzteSitzung(cookie)?.loginToken).toBe(TOKEN);
  });

  it('meldet auch ohne Schlüssel an – dann gilt das alte Verhalten', async () => {
    vi.mocked(ct.login).mockResolvedValue({ cookie: ALT, user: USER });
    vi.mocked(ct.holeAnmeldeSchluessel).mockResolvedValue(null);
    const { req, res, cookie, json } = loginReqRes();

    await postLogin(req, res);

    expect(json).toHaveBeenCalledWith({ authenticated: true, user: USER });
    expect(gesetzteSitzung(cookie)?.loginToken).toBeNull();
  });
});
