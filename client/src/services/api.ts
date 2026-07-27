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

/**
 * Globaler „Sitzung abgelaufen"-Melder (#186, hierher gezogen mit #210/#211).
 *
 * Er sitzt bewusst HIER und nicht mehr am QueryClient: Nicht alles läuft über TanStack Query –
 * `services/annotations.ts` und `services/userSettings.ts` rufen `apiFetch` direkt auf. Am
 * QueryClient blieben ihre 401er unsichtbar, sie schalteten sich nur still selbst ab (#211). In
 * `apiFetch` kommt dagegen JEDER Aufruf vorbei, damit gilt die Regel wirklich global.
 *
 * **Ausnahme `/api/auth/…`:** Diese Endpunkte SIND die Sitzungsverwaltung. Ein 401 vom Login heißt
 * „falsches Passwort", nicht „Sitzung abgelaufen" – ohne die Ausnahme löste ein Tippfehler das
 * Abmelden samt Geräte-Aufräumen aus und löschte die Offline-Reserve (#210).
 */
let sessionExpiredHandler: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  sessionExpiredHandler = fn;
}

/** Gehört der Pfad zur Sitzungsverwaltung selbst? Dort ist ein 401 eine normale Antwort. */
function isAuthPath(path: string): boolean {
  return path.startsWith('/api/auth/');
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
    // Sitzung abgelaufen → einmal zentral melden (führt zum Login). Auth-Endpunkte ausgenommen:
    // dort ist 401 = „falsche Zugangsdaten", kein Sitzungsverlust (#210).
    if (res.status === 401 && !isAuthPath(path)) sessionExpiredHandler?.();
    throw new ApiError(res.status, message);
  }

  return body as T;
}
