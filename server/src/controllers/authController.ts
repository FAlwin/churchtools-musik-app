import type { Request, Response } from 'express';
import { z } from 'zod';
import * as ct from '../services/churchtools.js';
import { setSession, clearSession, readSession, isSessionExpired } from '../middleware/session.js';
import type { AuthStatus } from '@shared/types/index';

const loginSchema = z.object({
  email: z.string().min(1, 'E-Mail fehlt'),
  password: z.string().min(1, 'Passwort fehlt'),
});

/** POST /api/auth/login – meldet bei ChurchTools an und setzt das Session-Cookie. */
export async function postLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const { cookie, user } = await ct.login(email, password);
  setSession(res, cookie);
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
