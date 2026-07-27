import { describe, it, expect } from 'vitest';
import { joinKeys, splitKeys } from './pageKeys';

/**
 * #193: Auf diesen zwei Funktionen steht die Abhängigkeitskette der Seiten-Engine. Stimmt die
 * Hin-und-Rück-Umwandlung nicht, bekommen die Effekte entweder eine Endlosschleife (Identität
 * ändert sich immer) oder einen eingefrorenen Stand (Identität ändert sich nie).
 */
describe('joinKeys / splitKeys', () => {
  it('gibt die Schlüssel unverändert zurück', () => {
    const keys = ['worship_docdraw_song7_voriginal_0', 'worship_docdraw_song7_voriginal_1'];
    expect(splitKeys(joinKeys(keys))).toEqual(keys);
  });

  it('unterscheidet „kein Schlüssel" (null) von einem echten', () => {
    expect(splitKeys(joinKeys([null, 'a']))).toEqual([null, 'a']);
    expect(splitKeys(joinKeys([null, null]))).toEqual([null, null]);
  });

  it('leere Liste bleibt leer', () => {
    expect(splitKeys(joinKeys([]))).toEqual([]);
  });

  it('gleiche Schlüssel ergeben die GLEICHE Signatur (sonst liefe jeder Effekt bei jedem Render)', () => {
    expect(joinKeys(['a', null, 'b'])).toBe(joinKeys(['a', null, 'b']));
  });

  it('eine geänderte Stelle ändert die Signatur (sonst bliebe der alte Stand stehen)', () => {
    expect(joinKeys(['a', 'b'])).not.toBe(joinKeys(['a', 'c']));
    expect(joinKeys(['a', null])).not.toBe(joinKeys(['a', 'b']));
    // Reihenfolge zählt – Slot 0 und Slot 1 dürfen nicht verwechselbar sein.
    expect(joinKeys(['a', 'b'])).not.toBe(joinKeys(['b', 'a']));
  });

  it('verschmilzt nicht versehentlich (zwei Schlüssel ≠ ein zusammengesetzter)', () => {
    expect(joinKeys(['ab', 'c'])).not.toBe(joinKeys(['a', 'bc']));
  });
});
