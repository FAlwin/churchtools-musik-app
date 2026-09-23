import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { apiFetch, setSessionExpiredHandler } from './api';

/**
 * Globaler „Sitzung abgelaufen"-Melder (#186), seit #211 in `apiFetch` statt am QueryClient –
 * damit er auch die Sync-Dienste sieht, die an TanStack Query vorbeigehen. Die Auth-Endpunkte
 * sind ausgenommen: dort ist 401 „falsches Passwort", kein Sitzungsverlust (#210).
 */
function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Ausdrücklicher Typ: Seit vitest 4 ist ein bloßes `vi.fn()` nicht mehr als Rückruf zuweisbar.
/**
 * Die Gegenstelle: `/api/auth/me` antwortet mit `me` (Standard „abgemeldet" – wie der Server ohne
 * Anmelde-Schlüssel), alle anderen Anfragen der Reihe nach mit `stati` (der letzte gilt danach weiter).
 * Seit dem 23.09.2026 fragt `apiFetch` nach einem 401 dort einmal nach, bevor es abmeldet.
 */
function antwortet(
  stati: number | number[],
  me: { status: number; body?: unknown } = { status: 200, body: { authenticated: false } },
) {
  const liste = Array.isArray(stati) ? [...stati] : [stati];
  return vi.fn((url: string | URL) => {
    if (String(url).includes('/api/auth/me'))
      return Promise.resolve(jsonResponse(me.status, me.body));
    const status = liste.length > 1 ? liste.shift()! : liste[0];
    return Promise.resolve(jsonResponse(status, status === 200 ? { ok: true } : { error: 'x' }));
  });
}
const meAufrufe = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter((c) => String(c[0]).includes('/api/auth/me')).length;

let onExpired: Mock<() => void>;

beforeEach(() => {
  onExpired = vi.fn<() => void>();
  setSessionExpiredHandler(onExpired);
});

afterEach(() => {
  setSessionExpiredHandler(null);
  vi.restoreAllMocks();
});

describe('apiFetch – Sitzung-abgelaufen-Melder', () => {
  it('meldet bei 401 auf einer normalen Route', async () => {
    vi.stubGlobal('fetch', antwortet(401));
    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('meldet auch für die Sync-Dienste, die an TanStack Query vorbeigehen (#211)', async () => {
    vi.stubGlobal('fetch', antwortet(401));
    await expect(apiFetch('/api/annotations?songs=1')).rejects.toMatchObject({ status: 401 });
    await expect(apiFetch('/api/settings', { method: 'PUT', body: '{}' })).rejects.toMatchObject({
      status: 401,
    });
    expect(onExpired).toHaveBeenCalledTimes(2);
  });

  it('meldet NICHT bei falschem Passwort am Login (#210)', async () => {
    // Sonst löste ein Tippfehler das Abmelden samt Geräte-Aufräumen aus → Offline-Reserve weg.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(401, { error: 'E-Mail oder Passwort falsch.' })),
        ),
    );
    await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject(
      { status: 401 },
    );
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('meldet NICHT für die übrigen Auth-Endpunkte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401))),
    );
    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ status: 401 });
    await expect(apiFetch('/api/auth/logout', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('meldet NICHT bei anderen Fehlern (502 = offline, 403 = kein Zugriff)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(502))),
    );
    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 502 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(403))),
    );
    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 403 });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('meldet nicht bei Erfolg', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(apiFetch('/api/services')).resolves.toEqual({ ok: true });
    expect(onExpired).not.toHaveBeenCalled();
  });
});

/**
 * **Vor dem Abmelden einmal still erneuern** (23.09.2026). ChurchTools beendet seine Sitzung nach rund
 * einem Tag; ein 401 heißt deshalb meist nur das. `/api/auth/me` holt dann mit dem Anmelde-Schlüssel
 * eine neue – erst wenn das nicht geht, ist man abgemeldet.
 */
describe('apiFetch – still erneuern vor dem Abmelden', () => {
  it('erneuert, wiederholt die Anfrage und meldet NICHT ab', async () => {
    const f = antwortet([401, 200], { status: 200, body: { authenticated: true } });
    vi.stubGlobal('fetch', f);

    await expect(apiFetch('/api/services')).resolves.toEqual({ ok: true });
    expect(onExpired).not.toHaveBeenCalled();
    expect(meAufrufe(f)).toBe(1);
  });

  it('versucht es nur EINMAL – scheitert auch die Wiederholung, wird abgemeldet', async () => {
    const f = antwortet(401, { status: 200, body: { authenticated: true } });
    vi.stubGlobal('fetch', f);

    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(3); // Anfrage, Rückfrage, Wiederholung – keine Schleife
  });

  it('meldet NICHT ab, wenn die Rückfrage nur gerade nicht antwortet (vorübergehend ≠ ungültig)', async () => {
    const f = antwortet(401, { status: 503, body: {} });
    vi.stubGlobal('fetch', f);

    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('fünf gleichzeitige 401 teilen sich EINE Rückfrage', async () => {
    const f = antwortet(401);
    vi.stubGlobal('fetch', f);

    await Promise.allSettled(Array.from({ length: 5 }, () => apiFetch('/api/services')));
    expect(meAufrufe(f)).toBe(1);
  });
});
