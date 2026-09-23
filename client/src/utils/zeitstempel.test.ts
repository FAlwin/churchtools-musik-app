import { describe, expect, it } from 'vitest';
import { standKurz } from './zeitstempel';

/**
 * Der „Stand" eines Offline-Vorrats (#410): Terminliste und „Mehr" formatierten ihn getrennt und
 * waren schon auseinandergelaufen (mit/ohne Jahr). Jetzt gilt die Regel der ganzen App: das Jahr nur,
 * wenn es nicht das laufende ist.
 */
describe('standKurz', () => {
  const heute = new Date(2026, 8, 23, 12, 0);

  it('lässt im laufenden Jahr das Jahr weg', () => {
    expect(standKurz(new Date(2026, 8, 21, 9, 5).getTime(), heute)).toBe('21.09., 09:05');
  });

  it('nennt das Jahr, wenn es nicht das laufende ist', () => {
    expect(standKurz(new Date(2025, 11, 31, 23, 59).getTime(), heute)).toBe('31.12.2025, 23:59');
  });
});
