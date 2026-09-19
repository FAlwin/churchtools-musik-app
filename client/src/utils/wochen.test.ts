import { describe, it, expect } from 'vitest';
import { anzahlTage, plusTage, wochenStart, wochentagKurz } from './wochen';

describe('wochen – Tages-Helfer rechnen in Tagen, nicht in Zeitzonen', () => {
  it('findet den Montag – auch wenn der Tag ein Sonntag ist (Sonntag gehört zur Vorwoche)', () => {
    expect(wochenStart('2026-09-05')).toBe('2026-08-31'); // Samstag
    expect(wochenStart('2026-09-06')).toBe('2026-08-31'); // Sonntag → derselbe Montag
    expect(wochenStart('2026-09-07')).toBe('2026-09-07'); // Montag bleibt Montag
  });

  it('über den Jahreswechsel bleibt die Woche zusammen', () => {
    expect(wochenStart('2027-01-01')).toBe('2026-12-28');
    expect(plusTage('2026-12-28', 6)).toBe('2027-01-03');
  });

  it('Kleinkram: Wochentag, plusTage, Tage zählen', () => {
    expect(wochentagKurz('2026-09-06')).toBe('So');
    expect(plusTage('2026-02-28', 1)).toBe('2026-03-01');
    expect(plusTage('2026-03-01', -1)).toBe('2026-02-28');
    expect(anzahlTage('2026-09-15', '2026-09-18')).toBe(4);
  });
});
