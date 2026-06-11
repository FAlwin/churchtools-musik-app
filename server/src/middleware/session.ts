import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { HttpError } from './errorHandler.js';

const COOKIE_NAME = 'ct_session';

/** Express-Request um das ChurchTools-Session-Cookie erweitern. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctCookie?: string;
    }
  }
}

/** Speichert das ChurchTools-Session-Cookie signiert + httpOnly im Client-Cookie. */
export function setSession(res: Response, churchToolsCookie: string): void {
  res.cookie(COOKIE_NAME, churchToolsCookie, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    signed: true,
    maxAge: 1000 * 60 * 60 * 12, // 12 Stunden
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Middleware: stellt sicher, dass eine gültige Session vorliegt, und hängt sie an req.ctCookie. */
export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  const cookie = req.signedCookies?.[COOKIE_NAME];
  if (!cookie || typeof cookie !== 'string') {
    throw new HttpError(401, 'Nicht angemeldet.');
  }
  req.ctCookie = cookie;
  next();
}
