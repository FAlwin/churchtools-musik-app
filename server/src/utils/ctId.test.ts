import { describe, it, expect } from 'vitest';
import { ctId } from './ctId.js';

/**
 * Der Grund für diese Funktion steht in ihrem ersten Test: **`Number(null)` ist 0.**
 *
 * Beim ersten Wurf von #322/Schritt 7 stand `map(Number).filter(Number.isInteger)` an zwei Stellen,
 * und beide hätten aus einem `null` in der Rechte-Liste die Kategorie 0 („Aktive Songs") gemacht –
 * also ein Recht erfunden. Aufgefallen ist das einem Test, nicht dem Compiler.
 */
describe('ctId', () => {
  it('verwandelt `null` NICHT in die ID 0 – der Grund für diese Funktion', () => {
    expect(ctId(null)).toBeNull();
    expect(ctId(undefined)).toBeNull();
    // Gegenprobe zur Erinnerung, warum: der naive Weg liefert hier eine gültige ID.
    expect(Number.isInteger(Number(null))).toBe(true);
  });

  it('lässt die 0 durch – bei den Lied-Kategorien ist sie echt („Aktive Songs")', () => {
    expect(ctId(0)).toBe(0);
    expect(ctId('0')).toBe(0);
  });

  it('nimmt Zeichenketten, weil die alte ChurchTools-Schnittstelle sie so liefert', () => {
    expect(ctId('1')).toBe(1);
    expect(ctId('42')).toBe(42);
  });

  it('lehnt alles ab, was keine Ganzzahl ist', () => {
    expect(ctId('')).toBeNull();
    expect(ctId('   ')).toBeNull();
    expect(ctId('x')).toBeNull();
    expect(ctId(true)).toBeNull();
    expect(ctId(1.5)).toBeNull();
    expect(ctId(NaN)).toBeNull();
    expect(ctId({})).toBeNull();
    expect(ctId([])).toBeNull();
  });
});
