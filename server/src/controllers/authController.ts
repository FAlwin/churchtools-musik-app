import type { Request, Response } from 'express';
import { z } from 'zod';
import { login, logout, whoami } from '../services/ctAuth.js';
import { setSession, clearSession, readSession, isSessionExpired } from '../middleware/session.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthStatus } from '@shared/types/index';

const loginSchema = z.object({
  // Längen deckeln: verhindert, dass über das 8-MB-Body-Limit riesige Strings an ChurchTools
  // weitergereicht werden. Reale E-Mails/Passwörter liegen weit darunter.
  email: z.string().min(1, 'E-Mail fehlt').max(200, 'E-Mail zu lang'),
  password: z.string().min(1, 'Passwort fehlt').max(200, 'Passwort zu lang'),
});

/** POST /api/auth/login – meldet bei ChurchTools an und setzt das Session-Cookie. */
export async function postLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const { cookie, user } = await login(email, password);
  // Konto-ID wandert mit ins signierte Cookie (#149): Der Rechte-Cache kann damit auch
  // überbrücken, wenn `whoami` während eines ChurchTools-Aussetzers nicht antwortet.
  setSession(res, cookie, Date.now(), user.id);
  const status: AuthStatus = { authenticated: true, user };
  res.json(status);
}

/**
 * POST /api/auth/logout – verwirft die Session. Beendet dabei auch die dahinterliegende
 * ChurchTools-Session (best effort): Nur das eigene Cookie zu löschen würde ein je
 * abgegriffenes Cookie weiter nutzbar lassen.
 */
export async function postLogout(req: Request, res: Response): Promise<void> {
  const session = readSession(req);
  if (session) await logout(session.ctCookie);
  clearSession(res);
  res.json({ authenticated: false } satisfies AuthStatus);
}

/** GET /api/auth/me – aktueller Anmeldestatus. */
export async function getMe(req: Request, res: Response): Promise<void> {
  const session = readSession(req);
  if (!session || isSessionExpired(session.issuedAt)) {
    if (session) clearSession(res); // abgelaufen → totes Cookie gleich verwerfen
    res.json({ authenticated: false } satisfies AuthStatus);
    return;
  }
  try {
    const user = await whoami(session.ctCookie);
    res.json({ authenticated: true, user } satisfies AuthStatus);
  } catch (e) {
    // NUR ein ausdrückliches 401 von ChurchTools heißt „diese Anmeldung ist tot" → Cookie verwerfen.
    //
    // Vorher flog die Anmeldung bei JEDEM Fehler weg (#270). Ein kurzer ChurchTools-Aussetzer, eine
    // Zeitüberschreitung oder ein Netz-Schluckauf hat damit alle abgemeldet – und weil das Cookie
    // dabei gelöscht wurde, half auch Warten nicht mehr, nur neu anmelden. Genau die Reaktion, die
    // #249 (Rechte-Cache) und #245 (Anmerkungs-Upload) für ihre Fälle schon verboten haben:
    // **ein vorübergehender Fehler darf nichts zerstören.**
    //
    // 403 ist bewusst NICHT dabei: Das kann ein vorübergehender Proxy-403 sein – deshalb reicht
    // `ctGet` es seit #152 überhaupt als 403 statt als 401 durch.
    if (e instanceof HttpError && e.status === 401) {
      clearSession(res);
      res.json({ authenticated: false } satisfies AuthStatus);
      return;
    }
    throw e; // vorübergehend → Fehler durchreichen, Anmeldung BEHALTEN
  }
}
