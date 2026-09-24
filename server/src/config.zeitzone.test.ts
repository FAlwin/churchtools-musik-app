import { describe, expect, it } from 'vitest';
import { STANDARD_ZEITZONE, pruefeZeitzone } from './config.js';

/** Die Zeitzone der Gemeinde (#414) – ein Tippfehler soll beim Start auffallen, nicht beim ersten Termin. */
describe('pruefeZeitzone', () => {
  it('ohne Eintrag gilt Europe/Berlin', () => {
    expect(pruefeZeitzone(undefined)).toBe(STANDARD_ZEITZONE);
    expect(pruefeZeitzone('  ')).toBe(STANDARD_ZEITZONE);
  });

  it('nimmt eine gültige Zeitzone an, auch mit Leerzeichen drumherum', () => {
    expect(pruefeZeitzone(' Europe/Vienna ')).toBe('Europe/Vienna');
  });

  it('bricht bei einem Tippfehler mit einer verständlichen Meldung ab', () => {
    expect(() => pruefeZeitzone('Europe/Berln')).toThrow(/keine gültige Zeitzone.*Europe\/Berlin/);
  });
});
