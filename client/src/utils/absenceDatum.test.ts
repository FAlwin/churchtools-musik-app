import { describe, it, expect } from 'vitest';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import { abwesenheitFuerTermin, tagKurz, zeitraumKurz } from './absenceDatum';

const ab = (p: Partial<Absence>): Absence => ({
  id: 1,
  startDate: '2026-10-04',
  endDate: '2026-10-04',
  startTime: null,
  endTime: null,
  comment: '',
  reason: null,
  reasonId: null,
  vonApp: true,
  ...p,
});

/** Ein Termin am 04.10., standardmäßig 10:00–11:30. */
const ev = (p: Partial<AbsenceEvent> = {}): AbsenceEvent => ({
  id: 10,
  name: 'Gottesdienst',
  date: '2026-10-04',
  startDate: '2026-10-04T10:00:00Z',
  endDate: '2026-10-04T11:30:00Z',
  ...p,
});

describe('absenceDatum', () => {
  it('abwesenheitFuerTermin nimmt die eigene vor der manuellen', () => {
    const manuell = ab({ id: 2, vonApp: false });
    const eigene = ab({ id: 3 });
    expect(abwesenheitFuerTermin([manuell, eigene], ev())?.id).toBe(3);
    expect(abwesenheitFuerTermin([manuell], ev())?.id).toBe(2);
    expect(abwesenheitFuerTermin([manuell], ev({ date: '2026-10-05' }))).toBeUndefined();
  });

  /**
   * **Zwei Termine an einem Tag** (Alwin, 22.09.2026). Ein Eintrag mit Uhrzeit gilt nur für den
   * Termin, auf den er passt; ein ganztägiger gilt weiter für beide.
   */
  it('trennt Vormittag und Nachmittag über das Zeitfenster', () => {
    const vormittags = ev({
      id: 1,
      startDate: '2026-10-04T10:00:00Z',
      endDate: '2026-10-04T11:30:00Z',
    });
    const nachmittags = ev({
      id: 2,
      startDate: '2026-10-04T16:00:00Z',
      endDate: '2026-10-04T18:00:00Z',
    });
    const nurVormittags = ab({
      id: 7,
      startTime: '2026-10-04T10:00:00Z',
      endTime: '2026-10-04T11:30:00Z',
    });

    expect(abwesenheitFuerTermin([nurVormittags], vormittags)?.id).toBe(7);
    expect(abwesenheitFuerTermin([nurVormittags], nachmittags)).toBeUndefined();
  });

  it('ganztägige Einträge decken weiterhin jeden Termin des Tages', () => {
    const ganztags = ab({ id: 8 });
    expect(abwesenheitFuerTermin([ganztags], ev({ id: 1 }))?.id).toBe(8);
    expect(
      abwesenheitFuerTermin(
        [ganztags],
        ev({ id: 2, startDate: '2026-10-04T16:00:00Z', endDate: '2026-10-04T18:00:00Z' }),
      )?.id,
    ).toBe(8);
  });

  /**
   * Zeitpunkte, nicht Text (Code-Check 23.09.2026). Der Termin um 13:00+02:00 ist 11:00 UTC und liegt
   * damit im Fenster 10–12 UTC. Als Zeichenkette verglichen käme „13:00…" aber NACH „12:00Z" – der
   * Haken erschiene nicht. (Der erste Testfall dazu traf zufällig auch mit Textvergleich; erst die
   * Gegenprobe zeigte das.)
   */
  it('vergleicht Uhrzeiten als Zeitpunkte – ein Offset ändert nichts', () => {
    const termin = ev({
      startDate: '2026-10-04T13:00:00+02:00',
      endDate: '2026-10-04T14:00:00+02:00',
    });
    const fenster = ab({
      id: 11,
      startTime: '2026-10-04T10:00:00Z',
      endTime: '2026-10-04T12:00:00Z',
    });
    expect(abwesenheitFuerTermin([fenster], termin)?.id).toBe(11);
  });

  it('das Fenster eines Termins deckt den unmittelbar folgenden NICHT mit ab', () => {
    const erster = ev({
      id: 1,
      startDate: '2026-10-04T10:00:00Z',
      endDate: '2026-10-04T12:00:00Z',
    });
    const zweiter = ev({
      id: 2,
      startDate: '2026-10-04T12:00:00Z',
      endDate: '2026-10-04T14:00:00Z',
    });
    const nurErster = ab({
      id: 9,
      startTime: '2026-10-04T10:00:00Z',
      endTime: '2026-10-04T12:00:00Z',
    });
    expect(abwesenheitFuerTermin([nurErster], erster)?.id).toBe(9);
    expect(abwesenheitFuerTermin([nurErster], zweiter)).toBeUndefined();
  });

  it('tagKurz zeigt Wochentag und Tag, das Jahr nur wenn es nicht das laufende ist', () => {
    const heute = new Date(2026, 8, 5);
    expect(tagKurz('2026-10-04', heute)).toBe('So, 04.10.');
    expect(tagKurz('2027-01-03', heute)).toBe('So, 03.01.2027');
  });

  it('zeitraumKurz fasst einen Tag kurz und einen Zeitraum mit Strich', () => {
    const heute = new Date(2026, 8, 5);
    expect(zeitraumKurz({ startDate: '2026-10-04', endDate: '2026-10-04' }, heute)).toBe(
      'So, 04.10.',
    );
    expect(zeitraumKurz({ startDate: '2026-10-03', endDate: '2026-10-11' }, heute)).toBe(
      'Sa, 03.10. – So, 11.10.',
    );
  });
});
