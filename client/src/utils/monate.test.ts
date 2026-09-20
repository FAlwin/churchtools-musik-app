import { describe, it, expect } from 'vitest';
import { letzterTag, monatKurz, monatLabel, monatPlus, monatVon, monateAb } from './monate';

describe('monate – die Monatsansicht rechnet in Strings, nicht in Zeitzonen', () => {
  it('addiert über den Jahreswechsel und zurück', () => {
    expect(monatPlus('2026-10', 3)).toBe('2027-01');
    expect(monatPlus('2026-10', 12)).toBe('2027-10');
    expect(monatPlus('2026-01', -1)).toBe('2025-12');
    expect(monatPlus('2026-01', -13)).toBe('2024-12');
  });
  it('beschriftet lang und kurz', () => {
    expect(monatLabel('2026-10')).toBe('Oktober 2026');
    expect(monatKurz('2027-03')).toBe('Mär 27');
  });
  it('liefert n Monate ab dem laufenden, der erste ist der von heute', () => {
    expect(monateAb('2026-11-19', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monatVon('2026-11-19')).toBe('2026-11');
  });
  it('kennt den letzten Tag – auch im Schaltjahr', () => {
    expect(letzterTag('2026-02')).toBe('2026-02-28');
    expect(letzterTag('2028-02')).toBe('2028-02-29');
    expect(letzterTag('2026-12')).toBe('2026-12-31');
  });
});
