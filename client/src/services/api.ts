/**
 * Zentrale fetch-Hilfe für alle Aufrufe an das eigene Backend.
 * Schickt Cookies mit (credentials), wirft bei Fehlern eine ApiError mit Klartext.
 */
import { markReachable } from './reachability';
import { BASE } from './apiBase';

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

/**
 * **Vor dem Abmelden einmal still erneuern** (23.09.2026).
 *
 * ChurchTools beendet seine Sitzung nach rund einem Tag (gemessen: `Max-Age=86399`), unsere eigene
 * gilt 30 Tage. Bekommt eine Anfrage 401, heißt das deshalb meist nur „die ChurchTools-Sitzung ist
 * abgelaufen" – und `/api/auth/me` holt mit dem Anmelde-Schlüssel still eine neue (siehe
 * `authController.getMe`). Erst wenn das nicht geht, ist man wirklich abgemeldet.
 *
 * - **Eine Erneuerung für alle:** Laufen beim Öffnen fünf Anfragen gleichzeitig in 401, warten alle
 *   auf DENSELBEN Aufruf – sonst holte jede eine eigene ChurchTools-Sitzung.
 * - **„unklar" ist nicht „abgemeldet":** Antwortet `/api/auth/me` gar nicht (Netz, 5xx), wird NICHT
 *   abgemeldet – vorübergehend ist nicht ungültig. Die Anfrage scheitert, der nächste Versuch fragt neu.
 */
type Erneuerung = 'erneuert' | 'abgemeldet' | 'unklar';
let laufendeErneuerung: Promise<Erneuerung> | null = null;

function sitzungErneuern(): Promise<Erneuerung> {
  laufendeErneuerung ??= (async (): Promise<Erneuerung> => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return 'unklar';
      const status = (await res.json()) as { authenticated?: boolean };
      return status.authenticated === true ? 'erneuert' : 'abgemeldet';
    } catch {
      return 'unklar';
    }
  })().finally(() => {
    laufendeErneuerung = null;
  });
  return laufendeErneuerung;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  /** Intern: Das ist schon die Wiederholung nach einer Erneuerung – kein zweiter Versuch. */
  wiederholt = false,
): Promise<T> {
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
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  // 502/503/504 heißt nur dann „offline", wenn die Antwort NICHT von unserem App-Server stammt –
  // ein reiner Vorschalt-Fehler des Reverse-Proxys (Body leer oder HTML). ABER: Unser Server gibt
  // bei einem ChurchTools-Problem SELBST 502/504 zurück (Token-Endpunkt abgelehnt, CT-Timeout →
  // asGatewayError). Diese Antwort trägt unseren `{error}`-Body → unser Server LÄUFT, wir sind NICHT
  // offline. Ohne diese Unterscheidung kippte ein einzelner ChurchTools-Aussetzer die ganze App in
  // den Offline-/„ChurchTools antwortet nicht"-Zustand samt Login-Screen (#296). Jede andere Antwort
  // (400/401/403/404/500) heißt ohnehin: App-Server erreichbar.
  const vonAppServer = !!body && typeof body === 'object' && 'error' in body;
  markReachable(!([502, 503, 504].includes(res.status) && !vonAppServer));

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `Fehler ${res.status}`;
    // Sitzung abgelaufen → erst still erneuern, dann erst zentral melden (führt zum Login).
    // Auth-Endpunkte ausgenommen: dort ist 401 = „falsche Zugangsdaten", kein Sitzungsverlust (#210).
    if (res.status === 401 && !isAuthPath(path)) {
      const erneuerung = wiederholt ? 'abgemeldet' : await sitzungErneuern();
      if (erneuerung === 'erneuert') return apiFetch<T>(path, options, true);
      if (erneuerung === 'abgemeldet') sessionExpiredHandler?.();
    }
    throw new ApiError(res.status, message);
  }

  return body as T;
}

/**
 * Wie `apiFetch`, aber für BYTES statt JSON (#321) – zum Herunterladen einer Datei.
 *
 * **Nicht über `apiFetch`:** Das liest den Rumpf als Text und versucht, ihn als JSON zu verstehen –
 * bei einem PDF käme dabei kaputter Text heraus. Die Fehlerbehandlung ist aber dieselbe Frage, und
 * deshalb steht sie hier direkt daneben und nicht in einer fremden Datei.
 *
 * Bewusst schlichter als `apiFetch`: keine Offline-Erkennung am Rumpf (die braucht den `{error}`-Body
 * und ist bei einer Binärantwort nicht zu haben) und kein Sitzungs-Melder – ein Download ist nie der
 * erste Aufruf, die Sitzung wurde also schon woanders geprüft.
 */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    // Bei einem Fehler ist der Rumpf unser `{error}`-JSON, kein Binärinhalt.
    let message = `Fehler ${res.status}`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      /* kein JSON – dann bleibt die Statusmeldung */
    }
    throw new ApiError(res.status, message);
  }
  return res.blob();
}
