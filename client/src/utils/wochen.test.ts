import { describe, it, expect } from 'vitest';
import {
  anzahlTage,
  zeitraumKompakt,
  plusTage,
  wocheLabel,
  wocheTage,
  wochenAb,
  wochenStart,
  wochentagKurz,
} from './wochen';

describe('wochen – der Wochenstreifen rechnet in Tagen, nicht in Zeitzonen', () => {
  it('findet den Montag – auch wenn der Tag ein Sonntag ist (Sonntag gehört zur Vorwoche)', () => {
    expect(wochenStart('2026-09-05')).toBe('2026-08-31'); // Samstag
    expect(wochenStart('2026-09-06')).toBe('2026-08-31'); // Sonntag → derselbe Montag
    expect(wochenStart('2026-09-07')).toBe('2026-09-07'); // Montag bleibt Montag
  });

  it('über den Jahreswechsel bleibt die Woche zusammen', () => {
    expect(wochenStart('2027-01-01')).toBe('2026-12-28');
    expect(wocheTage('2026-12-28')[6]).toBe('2027-01-03');
  });

  it('beschriftet innerhalb eines Monats kurz, über den Wechsel mit beiden Monaten', () => {
    expect(wocheLabel('2026-09-14')).toBe('14. – 20. September');
    expect(wocheLabel('2026-09-28')).toBe('28. Sept. – 4. Okt.');
  });

  it('liefert n Wochen ab der aktuellen, jeweils ein Montag', () => {
    const w = wochenAb('2026-09-05', 3);
    expect(w).toEqual(['2026-08-31', '2026-09-07', '2026-09-14']);
  });

  it('Kleinkram: Wochentag, plusTage, Tage zählen', () => {
    expect(wochentagKurz('2026-09-06')).toBe('So');
    expect(plusTage('2026-02-28', 1)).toBe('2026-03-01');
    expect(anzahlTage('2026-09-15', '2026-09-18')).toBe(4);
  });
});

describe('zeitraumKompakt – die Leiste ist schmal', () => {
  it('ein Tag steht allein, zwei Tage mit Gedankenstrich, immer ohne Wochentag', () => {
    expect(zeitraumKompakt('2026-09-15')).toBe('15.09.');
    expect(zeitraumKompakt('2026-09-15', '2026-09-15')).toBe('15.09.');
    expect(zeitraumKompakt('2026-09-15', '2026-09-17')).toBe('15.09. – 17.09.');
  });
});
