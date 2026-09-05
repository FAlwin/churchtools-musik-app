import { describe, it, expect } from 'vitest';
import type { Absence } from '@shared/types/index';
import { abwesenheitFuer, deckt, tagKurz, zeitraumKurz } from './absenceDatum';

const ab = (p: Partial<Absence>): Absence => ({
  id: 1,
  startDate: '2026-10-04',
  endDate: '2026-10-04',
  comment: '',
  reason: null,
  eigene: true,
  ...p,
});

describe('absenceDatum', () => {
  it('deckt vergleicht Tage einschließlich – als Text, nicht als Zeitpunkt', () => {
    const a = ab({ startDate: '2026-10-03', endDate: '2026-10-11' });
    expect(deckt(a, '2026-10-03')).toBe(true);
    expect(deckt(a, '2026-10-11')).toBe(true);
    expect(deckt(a, '2026-10-12')).toBe(false);
  });

  it('abwesenheitFuer nimmt die eigene vor der manuellen', () => {
    const manuell = ab({ id: 2, eigene: false });
    const eigene = ab({ id: 3 });
    expect(abwesenheitFuer([manuell, eigene], '2026-10-04')?.id).toBe(3);
    expect(abwesenheitFuer([manuell], '2026-10-04')?.id).toBe(2);
    expect(abwesenheitFuer([manuell], '2026-10-05')).toBeUndefined();
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
