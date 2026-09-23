// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pullSettings, resetSync } from './userSettings';
import { setSessionExpiredHandler } from './api';

/**
 * #211: Nach einem 401 schaltet der Sync sich selbst ab (`disabled`), damit nicht bei jedem
 * Tastendruck vergeblich gefunkt wird. Bis v2.14.1 wurde der Schalter NIE zurückgesetzt – nach
 * einem automatischen Abmelden und erneuter Anmeldung in derselben Seiten-Lebensdauer speicherte
 * die App nur noch lokal, und die Einstellungen gingen geräteübergreifend still verloren.
 * `resetSync()` (aufgerufen in `useAuth.loginMutation.onSuccess`) macht den Sync wieder scharf.
 */
function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  setSessionExpiredHandler(null); // in diesem Test nicht von Interesse
  resetSync(); // Modulzustand aus vorherigen Tests bereinigen
});

afterEach(() => {
  vi.restoreAllMocks();
  resetSync();
});

/**
 * Seit dem 23.09.2026 fragt `apiFetch` nach einem 401 einmal bei `/api/auth/me` nach, ob sich die
 * Sitzung still erneuern lässt. Diese Attrappe antwortet dort „abgemeldet" – so, wie der Server es
 * ohne Anmelde-Schlüssel täte – und alle übrigen Anfragen mit `status`.
 */
function ctAntwortet(status: number) {
  return vi.fn((url: string | URL) =>
    Promise.resolve(
      String(url).includes('/api/auth/me')
        ? jsonResponse(200, { authenticated: false })
        : jsonResponse(status, {}),
    ),
  );
}
/** Nur die Aufrufe zum Sync zählen – die Rückfrage bei `/api/auth/me` ist nicht gemeint. */
const syncAufrufe = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter((c) => !String(c[0]).includes('/api/auth/')).length;

describe('userSettings – Sync-Schalter (#211)', () => {
  it('schaltet nach einem 401 ab und funkt danach nicht mehr', async () => {
    const fetchMock = ctAntwortet(401);
    vi.stubGlobal('fetch', fetchMock);

    await pullSettings([1]); // 401 → disabled
    expect(syncAufrufe(fetchMock)).toBe(1);

    await pullSettings([1]); // darf nicht erneut funken
    expect(syncAufrufe(fetchMock)).toBe(1);
  });

  it('nach resetSync() läuft der Sync wieder (Neu-Anmeldung)', async () => {
    const fetchMock = ctAntwortet(401);
    vi.stubGlobal('fetch', fetchMock);
    await pullSettings([1]);
    expect(syncAufrufe(fetchMock)).toBe(1);

    // Nutzer meldet sich neu an → useAuth ruft resetSync()
    resetSync();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    await pullSettings([1]);
    expect(syncAufrufe(fetchMock)).toBe(2);
  });
});
