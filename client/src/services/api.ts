/**
 * Zentrale fetch-Hilfe für alle Aufrufe an das eigene Backend.
 * Schickt Cookies mit (credentials), wirft bei Fehlern eine ApiError mit Klartext.
 */
import { markReachable } from './reachability';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (e) {
    // fetch wirft nur bei echten Netzwerkfehlern (Server nicht erreichbar) – NICHT bei HTTP-Fehlern.
    // Verlässliches „offline/Server weg"-Signal, auch im WLAN ohne Internet (Saal-Fall, #32).
    markReachable(false);
    throw e;
  }
  // 502/503/504 = ein Vorschalt-Server (Reverse-Proxy) antwortet, aber unser App-Server ist NICHT
  // erreichbar → praktisch offline (kommt auch im Gemeinde-Netz vor, wenn nur das Backend fehlt).
  // Jede andere Antwort (auch 400/401/403/404/500) heißt: der App-Server ist erreichbar.
  markReachable(![502, 503, 504].includes(res.status));

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `Fehler ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}
