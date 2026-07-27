import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pushSetting, resetSync, setSettingsSyncErrorHandler } from './userSettings';
import { markReachable } from './reachability';
import { setSessionExpiredHandler } from './api';

/**
 * #213: `flush()` leerte `pending` VOR dem Request – schlug er fehl, war die Einstellung still
 * weg. Jetzt wird der Stapel bei vorübergehenden Fehlern zurückgelegt, und eine abgelehnte
 * Speicherung (413, Konto-Obergrenze) sagt dem Nutzer Bescheid, statt spurlos zu verschwinden.
 */
function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** localStorage-Ersatz für die Node-Umgebung (pushSetting selbst schreibt nicht, pullSettings schon). */
beforeEach(() => {
  vi.useFakeTimers();
  resetSync();
  markReachable(true);
  setSessionExpiredHandler(null);
  setSettingsSyncErrorHandler(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetSync();
  markReachable(true);
});

/** Debounce (600 ms) ablaufen lassen und die anhängenden Promises abarbeiten. */
async function runFlush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(700);
}

describe('userSettings – Speichern schlägt fehl (#213)', () => {
  it('413 meldet dem Nutzer die Ursache (statt still zu verschwinden)', async () => {
    const onError = vi.fn();
    setSettingsSyncErrorHandler(onError);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(jsonResponse(413, { error: 'Speicher-Obergrenze erreicht.' })),
      ),
    );

    pushSetting('worship_key_1', 'G');
    await runFlush();

    expect(onError).toHaveBeenCalledWith('Speicher-Obergrenze erreicht.');
  });

  it('413 wird nicht endlos wiederholt (ein erneuter Versuch scheiterte genauso)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(413, { error: 'voll' })));
    vi.stubGlobal('fetch', fetchMock);

    pushSetting('worship_key_1', 'G');
    await runFlush();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Serverfehler: der Stapel geht nicht verloren und wird erneut versucht', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushSetting('worship_key_1', 'G');
    await runFlush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Erreichbar → nach der Wartezeit erneut versuchen (vorher war die Änderung einfach weg).
    await vi.advanceTimersByTimeAsync(5100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as Record<string, string>;
    expect(sent.worship_key_1).toBe('G');
  });

  it('offline: kein vergebliches Dauerfunken, der Stapel wartet', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);
    markReachable(false);

    pushSetting('worship_key_1', 'G');
    await runFlush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('eine neuere Änderung gewinnt gegen den zurückgelegten Stapel', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushSetting('worship_key_1', 'G');
    await runFlush(); // schlägt fehl → 'G' wird zurückgelegt
    pushSetting('worship_key_1', 'A'); // Nutzer wählt inzwischen eine andere Tonart
    await runFlush();

    const sent = JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body)) as Record<string, string>;
    expect(sent.worship_key_1).toBe('A');
  });
});
