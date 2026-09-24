import { describe, expect, it } from 'vitest';
import { tagAusIso } from './isoTag.js';

/**
 * Der Tag eines Termins – in der Zeitzone der Gemeinde (#414). ChurchTools selbst rechnet genauso:
 * Eine Abwesenheit mit `startTime: 2026-12-03T23:30:00Z` legt es am **04.12.** an (gemessen an der
 * Test-Instanz, 24.09.2026). Die Tests laufen mit der Standard-Zeitzone Europe/Berlin.
 */
describe('tagAusIso (#410, #414)', () => {
  it('liefert den Tag eines Termins am Tage', () => {
    expect(tagAusIso('2026-10-04T08:00:00Z')).toBe('2026-10-04');
  });

  it('0:30 Uhr deutscher Zeit ist derselbe Tag, nicht der Vortag – Winterzeit', () => {
    expect(tagAusIso('2026-12-03T23:30:00Z')).toBe('2026-12-04');
  });

  it('0:30 Uhr deutscher Zeit – Sommerzeit (UTC+2)', () => {
    expect(tagAusIso('2026-10-03T22:30:00Z')).toBe('2026-10-04');
  });

  it('23:59 Uhr deutscher Zeit bleibt am selben Tag', () => {
    expect(tagAusIso('2026-10-04T21:59:00Z')).toBe('2026-10-04');
  });

  it('rechnet auch Zeitpunkte mit Versatz um', () => {
    expect(tagAusIso('2026-10-04T00:30:00+02:00')).toBe('2026-10-04');
    expect(tagAusIso('2026-10-04T23:30:00-02:00')).toBe('2026-10-05');
  });

  it('ohne Zeitzonen-Angabe gilt der Tag, wie er dasteht', () => {
    expect(tagAusIso('2026-10-04')).toBe('2026-10-04');
    expect(tagAusIso('2026-10-04T00:30:00')).toBe('2026-10-04');
  });

  it('eine andere Zeitzone ergibt einen anderen Tag', () => {
    expect(tagAusIso('2026-10-04T02:00:00Z', 'America/New_York')).toBe('2026-10-03');
    expect(tagAusIso('2026-10-04T02:00:00Z', 'UTC')).toBe('2026-10-04');
  });

  it('Unlesbares fällt auf den Text zurück, statt zu werfen', () => {
    expect(tagAusIso('2026-13-99T99:00:00Z')).toBe('2026-13-99');
  });
});
