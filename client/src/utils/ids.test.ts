import { afterEach, describe, expect, it, vi } from 'vitest';
import { neueId } from './ids';

/**
 * Die eine ID-Erzeugung für Links und Termin-Arten.
 *
 * **Der Rückfall ist der eigentliche Prüfpunkt:** `crypto.randomUUID` gibt es nur im sicheren
 * Kontext. Im LAN-Betrieb über HTTP fehlt er, und ohne Rückfall bekäme jeder neue Eintrag die ID
 * `undefined` – der Server lehnte ihn ab, und niemand wüsste, warum.
 */
describe('neueId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('nimmt die UUID des Browsers, wenn es sie gibt', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    expect(neueId('t')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('erzeugt ohne `randomUUID` eine eigene ID mit dem Präfix', () => {
    vi.stubGlobal('crypto', {});
    const id = neueId('l');
    expect(id.startsWith('l')).toBe(true);
    expect(id.length).toBeGreaterThan(8);
    expect(id).not.toContain('undefined');
  });

  it('liefert zwei Aufrufe nicht dieselbe ID', () => {
    vi.stubGlobal('crypto', {});
    expect(neueId('t')).not.toBe(neueId('t'));
  });
});
