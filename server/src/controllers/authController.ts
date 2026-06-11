import type { Request, Response } from 'express';
import { z } from 'zod';
import * as ct from '../services/churchtools.js';
import { setSession, clearSession } from '../middleware/session.js';
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

/** POST /api/auth/logout – verwirft die Session. */
export function postLogout(_req: Request, res: Response): void {
  clearSession(res);
  res.json({ authenticated: false } satisfies AuthStatus);
}

/** GET /api/auth/me – aktueller Anmeldestatus. */
export async function getMe(req: Request, res: Response): Promise<void> {
  const cookie = req.signedCookies?.ct_session;
  if (!cookie || typeof cookie !== 'string') {
    res.json({ authenticated: false } satisfies AuthStatus);
    return;
  }
  try {
    const user = await ct.whoami(cookie);
    res.json({ authenticated: true, user } satisfies AuthStatus);
  } catch {
    clearSession(res);
    res.json({ authenticated: false } satisfies AuthStatus);
  }
}
