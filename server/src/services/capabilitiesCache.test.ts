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

/**
 * Was `getCachedCapabilities` daraus macht: die sensiblen Rechte werden beim Überbrücken auf `false`
 * gesetzt (`isAdmin` seit #249, `canUseGlobalNotes` seit #282 – Lesezugriff auf FREMDE Anmerkungen).
 * Die übrigen (eigenen) Lese-/Bearbeitungsrechte werden überbrückt.
 */
const BRIDGED: UserCapabilities = { ...CAPS, isAdmin: false, canUseGlobalNotes: false };

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

  it('merkt sich Rechte pro Konto und gibt sie (überbrückt) zurück', async () => {
    await mod.rememberCapabilities(42, CAPS);
    expect(await mod.getCachedCapabilities(42)).toEqual(BRIDGED);
    // Anderes Konto bleibt unberührt.
    expect(await mod.getCachedCapabilities(99)).toBeNull();
  });

  it('überlebt einen Neustart (aus der Datei gelesen)', async () => {
    await mod.rememberCapabilities(7, CAPS);
    mod.__resetForTests(); // simuliert frischen Prozess/Container
    expect(await mod.getCachedCapabilities(7)).toEqual(BRIDGED);
  });

  it('liefert einen zu alten Stand nicht mehr aus', async () => {
    const long = mod.CACHE_MAX_AGE_MS + 1;
    await mod.rememberCapabilities(7, CAPS, 1_000);
    // „Jetzt" ist deutlich später als der gemerkte Zeitpunkt → gilt als veraltet.
    expect(await mod.getCachedCapabilities(7, 1_000 + long)).toBeNull();
    // Innerhalb der Frist weiterhin gültig.
    expect(await mod.getCachedCapabilities(7, 1_000 + mod.CACHE_MAX_AGE_MS)).toEqual(BRIDGED);
  });
});

/**
 * #249: Das Überbrückungsfenster stand auf 30 Tagen, gedacht ist es für Aussetzer von Sekunden – und
 * es überbrückte auch `isAdmin`. Ein Konto, dem in ChurchTools gerade das Admin-Recht entzogen wurde,
 * dessen Sitzung aber noch lebt, hätte damit bis zu einen Monat weiter Verwaltungs-Endpunkte
 * beschreiben können.
 */
describe('Überbrückung ist konservativ (#249)', () => {
  it('gibt ein gemerktes Admin-Recht NICHT aus dem Cache zurück', async () => {
    await mod.rememberCapabilities(5, { ...CAPS, isAdmin: true });
    const bridged = await mod.getCachedCapabilities(5);
    expect(bridged?.isAdmin).toBe(false);
    // Die Lese-Rechte werden dagegen überbrückt – das ist der Zweck des Caches.
    expect(bridged?.canViewSongs).toBe(true);
    expect(bridged?.canViewAgendas).toBe(true);
  });

  it('gibt ein gemerktes canUseGlobalNotes NICHT aus dem Cache zurück (#282)', async () => {
    // Das Recht gibt Lesezugriff auf die Anmerkungen ANDERER. Wird jemand aus der Musiker-Gruppe
    // entfernt, dessen Sitzung aber noch läuft, dürfte er sonst bis zu 12 h weiter fremde Notizen
    // lesen. In #249 war nur `isAdmin` abgedeckt – die Schwesterstelle wurde jetzt nachgezogen.
    await mod.rememberCapabilities(6, { ...CAPS, canUseGlobalNotes: true });
    const bridged = await mod.getCachedCapabilities(6);
    expect(bridged?.canUseGlobalNotes).toBe(false);
    // Die eigenen Lese-Rechte bleiben überbrückt.
    expect(bridged?.canViewSongs).toBe(true);
  });

  it('das Fenster liegt im Stunden-Bereich, nicht im Wochen-Bereich', async () => {
    // Wächter gegen ein erneutes Aufweiten: zu überbrücken sind Sekunden-Aussetzer.
    const stunden = mod.CACHE_MAX_AGE_MS / (60 * 60 * 1000);
    expect(stunden).toBeGreaterThanOrEqual(1);
    expect(stunden).toBeLessThanOrEqual(24);
  });
});
