import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { UserCapabilities } from './churchtools.js';

// Ablageort des Rechte-Caches VOR dem Modul-Import setzen (config.ts liest beim Import).
const cacheFile = path.join(os.tmpdir(), `capbridge-test-${process.pid}.json`);
process.env.CAPABILITIES_CACHE_PATH = cacheFile;

type Ct = typeof import('./churchtools.js');
type Cache = typeof import('./capabilitiesCache.js');
let ct: Ct;
let cache: Cache;

beforeAll(async () => {
  ct = await import('./churchtools.js');
  cache = await import('./capabilitiesCache.js');
});

beforeEach(async () => {
  await fs.rm(cacheFile, { force: true });
  cache.__resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CAPS: UserCapabilities = {
  canViewSongs: true,
  canViewAgendas: true,
  canEditAgendas: true,
  canEditSongs: false,
  isAdmin: false,
  canUseGlobalNotes: true,
};

/**
 * Was beim Überbrücken aus `CAPS` wird: Die sensiblen Rechte kommen NICHT aus dem Cache – `isAdmin`
 * seit #249, `canUseGlobalNotes` seit #282 (es gibt Lesezugriff auf die Anmerkungen ANDERER).
 * Steht auch in `capabilitiesCache.test.ts`; wird die Liste erweitert, sind BEIDE Stellen nachzuziehen.
 */
const CAPS_BRIDGED: UserCapabilities = { ...CAPS, isAdmin: false, canUseGlobalNotes: false };

// permissions/global-Antwort während eines CT-Aussetzers: churchservice-Block vorhanden,
// aber alle Rechte-Arrays leer (sieht aus wie „kein Zugriff") – exakt der Vorfall vom 13.07.2026.
const EMPTY_PERMS = { data: { churchservice: { 'view songcategory': [], 'view agenda': [] } } };

function jsonRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('getCapabilities – Überbrückung realer ChurchTools-Aussetzer (#149)', () => {
  it('überbrückt mit Konto-ID aus dem Session-Cookie OHNE whoami-Aufruf', async () => {
    await cache.rememberCapabilities(42, CAPS);
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const caps = await ct.getCapabilities('ChurchTools_s=bridge1', 42);

    // Überbrückt wird, aber ohne die sensiblen Rechte (#249/#282) – siehe CAPS_BRIDGED.
    expect(caps).toEqual(CAPS_BRIDGED);
    // Nur permissions/global – whoami darf NICHT nötig gewesen sein. Genau diese Abhängigkeit
    // war die Lücke: Hing whoami mit, konnte der Cache nie überbrücken.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('halb tote Session (Rechte leer + whoami 401, kein Cache) → 401 statt „Erneut versuchen"-Sackgasse', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      if (u.includes('/api/whoami')) return jsonRes({ message: 'unauthorized' }, 401);
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ct.getCapabilities('ChurchTools_s=bridge2', null)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('kein Cache, whoami ok: weiterhin „alles false" ohne Wurf (echte Nicht-Berechtigte)', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      if (u.includes('/api/whoami'))
        return jsonRes({ data: { id: 7, firstName: 'Test', lastName: 'Person' } });
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const caps = await ct.getCapabilities('ChurchTools_s=bridge3', null);

    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
    expect(caps.canUseGlobalNotes).toBe(false);
  });
});
