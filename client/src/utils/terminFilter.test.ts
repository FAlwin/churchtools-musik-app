import { describe, expect, it } from 'vitest';
import type { AbsenceEvent } from '@shared/types/index';
import { filtereTermine, kalenderAus, umschalten, wirksameAuswahl } from './terminFilter';

/**
 * Der Kalender-Filter (#400) als reine Regeln. Die wichtigste steht unten: Eine Auswahl, auf die
 * kein geladener Termin passt, gilt als „alle" – sonst stünde eine leere Liste da, ohne dass ein
 * Knopf sagt, warum.
 */
const ev = (id: number, kalender: AbsenceEvent['kalender']): AbsenceEvent => ({
  id,
  name: `Termin ${id}`,
  date: '2026-10-04',
  startDate: '2026-10-04T10:00:00Z',
  kalender,
});
const GD = { id: '1', name: 'Gottesdienst' };
const GA = { id: '2', name: 'Gebetsabend' };

describe('kalenderAus', () => {
  it('nennt jeden Kalender einmal, nach Namen sortiert', () => {
    expect(kalenderAus([ev(1, GD), ev(2, GA), ev(3, GD)])).toEqual([GA, GD]);
  });

  it('übergeht Termine ohne Kalender', () => {
    expect(kalenderAus([ev(1, null), ev(2, GD)])).toEqual([GD]);
  });

  it('filtert auf die ID, nicht den Namen – ein umbenannter Kalender bleibt derselbe', () => {
    const r = kalenderAus([
      ev(1, { id: '1', name: 'Gottesdienst' }),
      ev(2, { id: '1', name: 'GD' }),
    ]);
    expect(r).toHaveLength(1);
  });
});

describe('filtereTermine', () => {
  const alle = [ev(1, GD), ev(2, GA), ev(3, null)];

  it('ohne Auswahl bleibt alles', () => {
    expect(filtereTermine(alle, [])).toHaveLength(3);
  });

  it('mit Auswahl nur die passenden – Termine OHNE Kalender bleiben immer', () => {
    expect(filtereTermine(alle, ['2']).map((e) => e.id)).toEqual([2, 3]);
  });

  it('mehrere gleichzeitig', () => {
    expect(filtereTermine(alle, ['1', '2']).map((e) => e.id)).toEqual([1, 2, 3]);
  });
});

describe('wirksameAuswahl', () => {
  it('lässt eine Wahl fallen, die es unter den geladenen Terminen nicht gibt', () => {
    expect(wirksameAuswahl(['99'], [ev(1, GD)])).toEqual([]);
  });

  it('behält, was es gibt', () => {
    expect(wirksameAuswahl(['1', '99'], [ev(1, GD)])).toEqual(['1']);
  });
});

describe('umschalten', () => {
  it('nimmt auf und wieder heraus', () => {
    expect(umschalten([], '1')).toEqual(['1']);
    expect(umschalten(['1', '2'], '1')).toEqual(['2']);
  });
});
