// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getOfflineRegistry, pruneOfflineRegistry } from './offline';
import { heuteIso } from '../utils/heute';

const REG_KEY = 'worship:offline-services';

describe('Offline-Verzeichnis (#32)', () => {
  beforeEach(() => localStorage.clear());

  it('liest ein leeres Verzeichnis als leeres Objekt', () => {
    expect(getOfflineRegistry()).toEqual({});
  });

  it('übersteht kaputte Daten im Speicher', () => {
    localStorage.setItem(REG_KEY, '{kaputt');
    expect(getOfflineRegistry()).toEqual({});
  });

  it('räumt vergangene Gottesdienste auf, behält heutige und kommende', () => {
    // „Heute" über dieselbe Funktion wie der Code (`heuteIso`, LOKAL). Hier stand bis zum 24.09.2026
    // `toISOString().slice(0, 10)` – der UTC-Tag. Zwischen 0 und 2 Uhr deutscher Zeit ist das noch
    // gestern, und der Test fiel genau dann um (nachts beim Durchlauf aufgefallen). Dieselbe Falle,
    // die v2.25.1 im Code behoben hatte; der Test baute die alte Rechnung nach, statt den Erzeuger
    // zu nutzen.
    const today = heuteIso();
    localStorage.setItem(
      REG_KEY,
      JSON.stringify({
        1: { savedAt: 1, date: '2000-01-01' },
        2: { savedAt: 2, date: today },
        3: { savedAt: 3, date: '2099-12-31' },
      }),
    );
    pruneOfflineRegistry();
    const reg = getOfflineRegistry();
    expect(Object.keys(reg)).toEqual(['2', '3']);
  });
});
