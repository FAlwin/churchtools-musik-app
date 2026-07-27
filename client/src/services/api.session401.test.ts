import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

let onExpired: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onExpired = vi.fn();
  setSessionExpiredHandler(onExpired);
});

afterEach(() => {
  setSessionExpiredHandler(null);
  vi.restoreAllMocks();
});

describe('apiFetch – Sitzung-abgelaufen-Melder', () => {
  it('meldet bei 401 auf einer normalen Route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401, { error: 'abgelaufen' }))),
    );
    await expect(apiFetch('/api/services')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('meldet auch für die Sync-Dienste, die an TanStack Query vorbeigehen (#211)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401))),
    );
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
