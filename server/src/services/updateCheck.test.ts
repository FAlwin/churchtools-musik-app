/**
 * Wachtests (#152) für den Update-Check-Cache. Wichtig, weil die anonyme GitHub-API nur ~60
 * Anfragen/Stunde erlaubt: Erfolge werden lang (6 h), Fehler/leer nur kurz (ERROR_CACHE_MS = 15 min)
 * gecacht – letzteres, damit ein neu erscheinendes Release bald sichtbar wird, ohne bei jedem
 * Aufruf einen ausgehenden Request auszulösen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ERROR_CACHE_MS = 15 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000;

/** Frisches Modul (der Cache lebt im Modul-Scope) + kontrollierbarer fetch/Zeitgeber. */
async function freshModule() {
  vi.resetModules();
  return await import('./updateCheck.js');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getLatestRelease – Cache-Fenster (#152)', () => {
  it('cacht einen Erfolg lang (kein zweiter Request innerhalb 6 h)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v2.13.5', html_url: 'https://example/rel' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getLatestRelease } = await freshModule();

    expect(await getLatestRelease()).toEqual({
      latest: '2.13.5',
      tag: 'v2.13.5',
      url: 'https://example/rel',
    });
    await getLatestRelease();
    vi.setSystemTime(Date.now() + CACHE_MS - 1000);
    await getLatestRelease();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cacht einen Fehler NUR kurz: innerhalb ERROR_CACHE_MS kein neuer Request, danach schon', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    const { getLatestRelease } = await freshModule();

    expect(await getLatestRelease()).toEqual({ latest: null, tag: null, url: null });
    // innerhalb des kurzen Fensters: aus dem Cache
    vi.setSystemTime(Date.now() + ERROR_CACHE_MS - 1000);
    await getLatestRelease();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // nach dem kurzen Fenster: erneut versuchen (NICHT 6 h warten)
    vi.setSystemTime(Date.now() + 2000);
    await getLatestRelease();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cacht auch Offline/Timeout kurz (wirft nicht nach außen)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const { getLatestRelease } = await freshModule();

    expect(await getLatestRelease()).toEqual({ latest: null, tag: null, url: null });
    vi.setSystemTime(Date.now() + ERROR_CACHE_MS - 1000);
    await getLatestRelease();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
