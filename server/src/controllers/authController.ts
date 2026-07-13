import type { Request, Response } from 'express';
import { z } from 'zod';
import * as ct from '../services/churchtools.js';
import { setSession, clearSession, readSession, isSessionExpired } from '../middleware/session.js';
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
  const { cookie, user } = await ct.login(email, password);
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
  if (session) await ct.logout(session.ctCookie);
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
    const user = await ct.whoami(session.ctCookie);
    res.json({ authenticated: true, user } satisfies AuthStatus);
  } catch {
    clearSession(res);
    res.json({ authenticated: false } satisfies AuthStatus);
  }
}
