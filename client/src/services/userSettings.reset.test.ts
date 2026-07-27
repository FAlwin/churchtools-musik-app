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

describe('userSettings – Sync-Schalter (#211)', () => {
  it('schaltet nach einem 401 ab und funkt danach nicht mehr', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    vi.stubGlobal('fetch', fetchMock);

    await pullSettings([1]); // 401 → disabled
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await pullSettings([1]); // darf nicht erneut funken
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('nach resetSync() läuft der Sync wieder (Neu-Anmeldung)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    vi.stubGlobal('fetch', fetchMock);
    await pullSettings([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Nutzer meldet sich neu an → useAuth ruft resetSync()
    resetSync();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await pullSettings([1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
