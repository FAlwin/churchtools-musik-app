/// <reference types="node" />
// Die Node-Typen fordert diese Datei selbst an: Sie stellt bewusst `process.env.TZ` um. Bis vitest 3
// kamen sie stillschweigend mit, seit vitest 4 nicht mehr (#405) – der Client selbst braucht sie nicht.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { heuteIso } from './heute';

/**
 * **Der Test, der die Zeitzone wirklich prüft.**
 *
 * `toISOString().slice(0, 10)` liefert den Tag in UTC – in Deutschland zwischen Mitternacht und
 * 2 Uhr also den **Vortag**. Damit das hier auffällt und nicht von der Zeitzone des Prüfrechners
 * abhängt (die CI läuft in UTC, dort wären beide Rechenwege gleich), wird sie für diesen Test
 * ausdrücklich auf Europe/Berlin gestellt. Node liest `TZ` bei jedem `Date` neu.
 */
describe('heuteIso', () => {
  const vorher = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Berlin';
  });
  afterAll(() => {
    process.env.TZ = vorher;
  });

  it('nennt den Tag der Gemeinde, nicht den in UTC', () => {
    // 20.09.2026, 22:30 UTC = 21.09.2026, 00:30 in Berlin.
    const nachtsHalbEins = new Date(Date.UTC(2026, 8, 20, 22, 30));
    expect(heuteIso(nachtsHalbEins)).toBe('2026-09-21');
    // Genau das ist der Unterschied, um den es geht:
    expect(nachtsHalbEins.toISOString().slice(0, 10)).toBe('2026-09-20');
  });

  it('stimmt auch am Tag, wo beide Rechenwege gleich wären', () => {
    expect(heuteIso(new Date(Date.UTC(2026, 8, 21, 10, 0)))).toBe('2026-09-21');
  });

  it('füllt Monat und Tag zweistellig', () => {
    expect(heuteIso(new Date(Date.UTC(2026, 0, 5, 12, 0)))).toBe('2026-01-05');
  });
});
