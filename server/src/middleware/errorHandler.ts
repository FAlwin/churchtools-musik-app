import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Eigene Fehlerklasse mit HTTP-Statuscode. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
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
    res.status(err.status).json({ error: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Unerwarteter Fehler:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
};
