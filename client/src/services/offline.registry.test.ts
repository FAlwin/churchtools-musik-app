// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getOfflineRegistry, pruneOfflineRegistry } from './offline';

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
    const today = new Date().toISOString().slice(0, 10);
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
