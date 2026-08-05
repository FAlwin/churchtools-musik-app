import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Eigene Fehlerklasse mit HTTP-Statuscode.
 *
 * `retryAfterMs` ist optional und wird vom `errorHandler` in den `Retry-After`-Kopf übersetzt (#300):
 * Bremst ChurchTools uns aus, ist „wann darf ich wieder?" die einzig brauchbare Zusatzinformation.
 * Der dritte Parameter bleibt optional, damit die bestehenden ~58 `new HttpError(...)` unberührt sind.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 404 für unbekannte Routen. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden' });
};

/** Zentrale Fehlerbehandlung – immer als Letztes registrieren. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Ungültige Eingabe', details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    // `Retry-After` in Sekunden, aufgerundet und mindestens 1 – der Kopf erlaubt keine 0 und keine
    // Bruchteile (#300). Nur gesetzt, wenn der Fehler wirklich eine Wartezeit kennt.
    if (err.retryAfterMs && err.retryAfterMs > 0) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(err.retryAfterMs / 1000))));
    }
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Unerwarteter Fehler:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
};
