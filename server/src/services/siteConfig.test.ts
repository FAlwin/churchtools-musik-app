import { describe, it, expect, beforeAll } from 'vitest';
import { SITE_CONFIG_GRENZEN } from '@shared/types/index';
import { tempDatei } from '../testHilfen/tempAblage.js';

/**
 * Termin-Arten in der Site-Konfiguration (#400) – Schema und Normalisierung.
 *
 * Der Pfad muss VOR dem Import stehen (`config.ts` liest ihn beim Laden), deshalb der dynamische
 * Import wie bei den anderen Ablage-Tests. Die Datei ist eindeutig je Lauf (`tempAblage`).
 */
process.env.SITE_CONFIG_PATH = tempDatei('siteconfig-test', 'site.json');

type Mod = typeof import('./siteConfig.js');
let mod: Mod;
beforeAll(async () => {
  mod = await import('./siteConfig.js');
});

describe('siteConfigSchema – Grenzen kommen aus @shared/types', () => {
  /**
   * Dieselben Zahlen wie im Formular (`SITE_CONFIG_GRENZEN`) – geprüft am Erzeuger, nicht an
   * Literalen. Wer im Schema wieder `.max(40)` von Hand hinschreibt und die Konstante weitet,
   * lässt diesen Test fallen (Code-Check 21.09.2026).
   */
  it('nimmt einen Namen bis zur Grenze an und lehnt ein Zeichen mehr ab', () => {
    const art = (laenge: number) => ({
      orgName: 'ECG',
      terminArten: [{ id: 'x', name: 'n'.repeat(laenge), suchwort: 'gd' }],
    });
    expect(mod.siteConfigSchema.safeParse(art(SITE_CONFIG_GRENZEN.terminArtName)).success).toBe(
      true,
    );
    expect(mod.siteConfigSchema.safeParse(art(SITE_CONFIG_GRENZEN.terminArtName + 1)).success).toBe(
      false,
    );
  });

  it('begrenzt das Suchwort ebenso', () => {
    const mitWort = (laenge: number) => ({
      orgName: 'ECG',
      terminArten: [{ id: 'x', name: 'Gottesdienst', suchwort: 'w'.repeat(laenge) }],
    });
    expect(
      mod.siteConfigSchema.safeParse(mitWort(SITE_CONFIG_GRENZEN.terminArtSuchwort)).success,
    ).toBe(true);
    expect(
      mod.siteConfigSchema.safeParse(mitWort(SITE_CONFIG_GRENZEN.terminArtSuchwort + 1)).success,
    ).toBe(false);
  });
});

describe('siteConfigSchema – Termin-Arten', () => {
  it('nimmt Arten an und trimmt', () => {
    const r = mod.siteConfigSchema.safeParse({
      orgName: 'ECG',
      terminArten: [{ id: 'gd', name: ' Gottesdienst ', suchwort: ' Gottes ' }],
    });
    expect(r.success).toBe(true);
    if (r.success)
      expect(r.data.terminArten[0]).toEqual({ id: 'gd', name: 'Gottesdienst', suchwort: 'Gottes' });
  });

  it('ohne Angabe ist die Liste leer – kein Filter', () => {
    const r = mod.siteConfigSchema.safeParse({ orgName: 'ECG' });
    expect(r.success && r.data.terminArten).toEqual([]);
  });

  it('lehnt eine Art ohne Namen oder ohne Suchwort ab', () => {
    expect(
      mod.siteConfigSchema.safeParse({
        orgName: 'ECG',
        terminArten: [{ id: 'x', name: '', suchwort: 'a' }],
      }).success,
    ).toBe(false);
    expect(
      mod.siteConfigSchema.safeParse({
        orgName: 'ECG',
        terminArten: [{ id: 'x', name: 'A', suchwort: ' ' }],
      }).success,
    ).toBe(false);
  });
});

describe('saveSiteConfig – Termin-Arten', () => {
  it('speichert die Arten und liest sie wieder', async () => {
    const saved = await mod.saveSiteConfig({
      orgName: 'ECG',
      terminArten: [{ id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' }],
    });
    expect(saved.terminArten).toHaveLength(1);
    expect((await mod.getSiteConfig()).terminArten).toEqual(saved.terminArten);
  });

  it('eine ID nur einmal – die gemerkte Auswahl auf dem Gerät hängt daran', async () => {
    const saved = await mod.saveSiteConfig({
      orgName: 'ECG',
      terminArten: [
        { id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' },
        { id: 'gd', name: 'Doppelt', suchwort: 'x' },
      ],
    });
    expect(saved.terminArten?.map((a) => a.name)).toEqual(['Gottesdienst']);
  });
});
