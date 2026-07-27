import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeReachable, markReachable, getReachable } from './reachability';

/**
 * #218: `reachable` kannte bisher nur den Weg nach „false" – zurück ging es nur zufällig, wenn
 * gerade ein API-Aufruf gelang. Auf dem Login-Screen läuft keiner, deshalb blieb der
 * Offline-Hinweis kleben und nur ein App-Neustart half. `probeReachable()` fragt aktiv nach.
 */
beforeEach(() => {
  markReachable(true); // definierter Ausgangszustand
});

afterEach(() => {
  vi.restoreAllMocks();
  markReachable(true);
});

describe('probeReachable', () => {
  it('holt den Zustand zurück auf „erreichbar", wenn der Server antwortet', async () => {
    markReachable(false);
    expect(getReachable()).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))),
    );

    await expect(probeReachable()).resolves.toBe(true);
    expect(getReachable()).toBe(true);
  });

  it('setzt bei einem Netzwerkfehler auf „nicht erreichbar"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.reject(new TypeError('offline'))),
    );
    await expect(probeReachable()).resolves.toBe(false);
    expect(getReachable()).toBe(false);
  });

  it('wertet 502/503/504 als „Backend fehlt" (wie apiFetch)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 503 }))),
    );
    await expect(probeReachable()).resolves.toBe(false);
    expect(getReachable()).toBe(false);
  });

  it('eine andere Fehlerantwort heißt trotzdem „Server erreichbar"', async () => {
    markReachable(false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 404 }))),
    );
    await expect(probeReachable()).resolves.toBe(true);
    expect(getReachable()).toBe(true);
  });

  it('bündelt parallele Aufrufe zu EINER Anfrage', async () => {
    // online-Event, Sichtbarkeitswechsel und Anmeldeversuch können gleichzeitig auslösen.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([probeReachable(), probeReachable(), probeReachable()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
