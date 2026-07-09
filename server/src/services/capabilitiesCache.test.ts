import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { UserCapabilities } from './churchtools.js';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const cacheFile = path.join(os.tmpdir(), `capcache-test-${process.pid}.json`);
process.env.CAPABILITIES_CACHE_PATH = cacheFile;

type Mod = typeof import('./capabilitiesCache.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./capabilitiesCache.js');
});

beforeEach(async () => {
  await fs.rm(cacheFile, { force: true });
  mod.__resetForTests();
});

const CAPS: UserCapabilities = {
  canViewSongs: true,
  canViewAgendas: true,
  canEditAgendas: false,
  canEditSongs: false,
  isAdmin: false,
  canUseGlobalNotes: true,
};

describe('isCacheFresh', () => {
  it('gilt für einen eben gemerkten Stand', () => {
    const now = 1_000_000_000_000;
    expect(mod.isCacheFresh(now, now)).toBe(true);
  });
  it('gilt bis exakt zur Höchstdauer', () => {
    const now = 1_000_000_000_000;
    expect(mod.isCacheFresh(now - mod.CACHE_MAX_AGE_MS, now)).toBe(true);
  });
  it('gilt nicht mehr, sobald die Höchstdauer überschritten ist', () => {
    const now = 1_000_000_000_000;
    expect(mod.isCacheFresh(now - mod.CACHE_MAX_AGE_MS - 1, now)).toBe(false);
  });
});

describe('rememberCapabilities / getCachedCapabilities', () => {
  it('liefert nichts, solange nichts gemerkt wurde', async () => {
    expect(await mod.getCachedCapabilities(42)).toBeNull();
  });

  it('merkt sich Rechte pro Konto und gibt sie zurück', async () => {
    await mod.rememberCapabilities(42, CAPS);
    expect(await mod.getCachedCapabilities(42)).toEqual(CAPS);
    // Anderes Konto bleibt unberührt.
    expect(await mod.getCachedCapabilities(99)).toBeNull();
  });

  it('überlebt einen Neustart (aus der Datei gelesen)', async () => {
    await mod.rememberCapabilities(7, CAPS);
    mod.__resetForTests(); // simuliert frischen Prozess/Container
    expect(await mod.getCachedCapabilities(7)).toEqual(CAPS);
  });

  it('liefert einen zu alten Stand nicht mehr aus', async () => {
    const long = mod.CACHE_MAX_AGE_MS + 1;
    await mod.rememberCapabilities(7, CAPS, 1_000);
    // „Jetzt" ist deutlich später als der gemerkte Zeitpunkt → gilt als veraltet.
    expect(await mod.getCachedCapabilities(7, 1_000 + long)).toBeNull();
    // Innerhalb der Frist weiterhin gültig.
    expect(await mod.getCachedCapabilities(7, 1_000 + mod.CACHE_MAX_AGE_MS)).toEqual(CAPS);
  });
});
