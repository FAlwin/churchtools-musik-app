import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * #270: Ein **vorübergehender** ChurchTools-Fehler darf die Anmeldung nicht zerstören.
 *
 * `getMe` fragt bei ChurchTools nach, wer angemeldet ist. Bisher löschte JEDER Fehler dabei das
 * Session-Cookie – eine Zeitüberschreitung, ein 502, ein Netz-Schluckauf. Alle waren damit abgemeldet,
 * und weil das Cookie weg war, half auch Warten nicht mehr: nur neu anmelden. Im Gottesdienst heißt
 * das, mitten im Lied die ChurchTools-Zugangsdaten einzutippen.
 *
 * Seit #248 haben alle ChurchTools-Aufrufe eine Zeitgrenze (15 s) – die Wahrscheinlichkeit, dass hier
 * wirklich eine Ausnahme fliegt, ist damit gestiegen. Dieselbe Lehre wie #249 (Rechte-Cache) und #245
 * (Anmerkungs-Upload): **vorübergehend ≠ ungültig.**
 */
vi.mock('../services/ctAuth.js', () => ({
  whoami: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

const ct = await import('../services/ctAuth.js');
const { getMe } = await import('./authController.js');

/** Gültiges Bestands-Cookie im Klartext – so muss `readSession` es lesen können. */
const SESSION = `${Date.now()}|u42|ChurchTools_sid=geheim`;

function fakeReqRes(): {
  req: Request;
  res: Response;
  json: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const clearCookie = vi.fn();
  return {
    req: { signedCookies: { ct_session: SESSION } } as unknown as Request,
    res: { json, clearCookie, cookie: vi.fn() } as unknown as Response,
    json,
    clearCookie,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('getMe – vorübergehender Fehler behält die Anmeldung (#270)', () => {
  it('Zeitüberschreitung (504): Cookie bleibt, Fehler wird durchgereicht', async () => {
    // Der Fall aus der Praxis: ChurchTools hängt, `ctSignal` bricht nach 15 s ab (#248).
    vi.mocked(ct.whoami).mockRejectedValue(
      new HttpError(504, 'ChurchTools antwortet gerade nicht. Bitte später erneut versuchen.'),
    );
    const { req, res, json, clearCookie } = fakeReqRes();

    await expect(getMe(req, res)).rejects.toMatchObject({ status: 504 });
    expect(clearCookie).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('502 von ChurchTools: Cookie bleibt', async () => {
    vi.mocked(ct.whoami).mockRejectedValue(new HttpError(502, 'ChurchTools-Fehler (500).'));
    const { req, res, clearCookie } = fakeReqRes();

    await expect(getMe(req, res)).rejects.toMatchObject({ status: 502 });
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('403 behält die Anmeldung – das kann ein vorübergehender Proxy-403 sein (#152)', async () => {
    // Genau deshalb reicht `ctGet` 403 seit #152 als 403 durch statt es zu 401 zu machen.
    vi.mocked(ct.whoami).mockRejectedValue(new HttpError(403, 'Kein Zugriff.'));
    const { req, res, clearCookie } = fakeReqRes();

    await expect(getMe(req, res)).rejects.toMatchObject({ status: 403 });
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('ein unerwarteter Fehler (kein HttpError) behält die Anmeldung ebenfalls', async () => {
    vi.mocked(ct.whoami).mockRejectedValue(new TypeError('fetch failed'));
    const { req, res, clearCookie } = fakeReqRes();

    await expect(getMe(req, res)).rejects.toThrow('fetch failed');
    expect(clearCookie).not.toHaveBeenCalled();
  });
});

describe('getMe – ein echtes 401 beendet die Anmeldung (#270)', () => {
  it('401 von ChurchTools: Cookie wird gelöscht und der Status ist „abgemeldet"', async () => {
    // Die Gegenrichtung: Wird die Sitzung ausdrücklich abgelehnt, MUSS das tote Cookie weg – sonst
    // hinge die App in dem Zwischenzustand, den #186 beseitigt hat.
    vi.mocked(ct.whoami).mockRejectedValue(new HttpError(401, 'Session abgelaufen.'));
    const { req, res, json, clearCookie } = fakeReqRes();

    await getMe(req, res);

    expect(clearCookie).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledWith({ authenticated: false });
  });

  it('im Normalfall kommt der Nutzer zurück und nichts wird gelöscht', async () => {
    vi.mocked(ct.whoami).mockResolvedValue({ id: 42, firstName: 'Test', lastName: 'Musiker' });
    const { req, res, json, clearCookie } = fakeReqRes();

    await getMe(req, res);

    expect(json).toHaveBeenCalledWith({
      authenticated: true,
      user: { id: 42, firstName: 'Test', lastName: 'Musiker' },
    });
    expect(clearCookie).not.toHaveBeenCalled();
  });
});
