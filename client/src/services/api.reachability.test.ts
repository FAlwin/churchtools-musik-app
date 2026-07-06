import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api';
import { getReachable, markReachable } from './reachability';

/** apiFetch muss den Erreichbarkeits-Status korrekt speisen (Grundlage der Offline-Erkennung, #32). */
describe('apiFetch → Erreichbarkeit', () => {
  beforeEach(() => markReachable(true));
  afterEach(() => vi.restoreAllMocks());

  it('Netzwerkfehler (kein Server) → offline und wirft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiFetch('/api/test')).rejects.toBeTruthy();
    expect(getReachable()).toBe(false);
  });

  it('HTTP-Fehler (401) zählt als erreichbar (Server antwortet) und wirft ApiError', async () => {
    markReachable(false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'nein' }), { status: 401 })),
    );
    await expect(apiFetch('/api/test')).rejects.toBeInstanceOf(ApiError);
    expect(getReachable()).toBe(true);
  });

  it('Gateway-Fehler 502 (Backend weg) → offline und wirft ApiError', async () => {
    markReachable(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })),
    );
    await expect(apiFetch('/api/test')).rejects.toBeInstanceOf(ApiError);
    expect(getReachable()).toBe(false);
  });

  it('Erfolg → erreichbar und liefert den Body', async () => {
    markReachable(false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 })),
    );
    await expect(apiFetch<{ ok: number }>('/api/test')).resolves.toEqual({ ok: 1 });
    expect(getReachable()).toBe(true);
  });
});
