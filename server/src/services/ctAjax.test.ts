import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CtOverloadedError } from './ctHttp.js';

/**
 * #383: 429 ist eine Drosselung, kein Serverfehler – auch auf der alten Schnittstelle.
 *
 * `ctAjax` ist der Pfad für SongSelect-Suche und -Download, `getMasterData` und die Liedtext-Vorschau.
 * Bremst ChurchTools dort, meldete die App „abgelehnt (429)" als 502 – und ein Massenlauf konnte die
 * Bremse nicht per `isCtOverloaded` erkennen. Die Regel galt an vier Stellen, hier war die fünfte.
 */
vi.mock('./ctCsrf.js', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('csrf-attrappe'),
  csrfWriteDenied: vi.fn((_cookie: string, text: string) => {
    throw Object.assign(new Error(text), { status: 403 });
  }),
}));

const { ctAjax } = await import('./ctAjax.js');

function antwort(status: number, body = '', retryAfter: string | null = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter : null) },
  } as unknown as Response;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('ctAjax – 429 ist eine Drosselung (#383)', () => {
  it('wirft CtOverloadedError mit Retry-After statt 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(429, 'Too Many Requests', '45')));
    const fehler = await ctAjax('ChurchTools_sid=x', 'getMasterData').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(CtOverloadedError);
    expect((fehler as CtOverloadedError).retryAfterMs).toBe(45_000);
  });

  it('ein echter Serverfehler (500) bleibt ein 502 mit dem Statuscode', async () => {
    // Die Gegenrichtung: Die neue Regel darf nur den 429 herausnehmen.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(500)));
    await expect(ctAjax('ChurchTools_sid=x', 'getMasterData')).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('(500)'),
    });
  });

  it('eine gültige Antwort kommt unverändert durch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(antwort(200, JSON.stringify({ status: 'success', data: { a: 1 } }))),
    );
    await expect(ctAjax('ChurchTools_sid=x', 'getMasterData')).resolves.toEqual({ a: 1 });
  });
});
