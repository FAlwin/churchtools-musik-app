// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadNav, saveNav, clearNav, type PersistedNav } from './navStorage';

const base: PersistedNav = {
  tab: 'termine',
  view: { type: 'setlist' },
  serviceId: 42,
  songIndex: 3,
  libSel: null,
  savedAt: Date.now(),
};

describe('navStorage', () => {
  beforeEach(() => localStorage.clear());

  it('liest einen gerade gespeicherten Stand wieder', () => {
    saveNav(base);
    expect(loadNav()).toEqual(base);
  });

  it('liefert null, wenn nichts gespeichert ist', () => {
    expect(loadNav()).toBeNull();
  });

  it('verwirft einen abgelaufenen Stand (älter als 8 h)', () => {
    saveNav({ ...base, savedAt: Date.now() - 1000 * 60 * 60 * 9 });
    expect(loadNav()).toBeNull();
  });

  it('verwirft kaputtes JSON, ohne zu werfen', () => {
    localStorage.setItem('worship:nav-v1', '{nicht-json');
    expect(loadNav()).toBeNull();
  });

  it('verwirft einen Stand ohne gültiges savedAt', () => {
    localStorage.setItem('worship:nav-v1', JSON.stringify({ tab: 'lieder' }));
    expect(loadNav()).toBeNull();
  });

  it('clearNav entfernt den gespeicherten Stand', () => {
    saveNav(base);
    clearNav();
    expect(loadNav()).toBeNull();
  });
});
