import { describe, it, expect } from 'vitest';
import { vanishedRows } from './vanishedRows';

const rows = [
  { id: 1, title: 'A' },
  { id: 2, title: 'B' },
  { id: 3, title: 'C' },
];

describe('vanishedRows (#178)', () => {
  it('liefert nichts, wenn alle Punkte noch da sind', () => {
    expect(vanishedRows(rows, new Set([1, 2, 3]))).toEqual([]);
  });

  it('findet einen mittleren gelöschten Punkt mit korrektem Vorgänger', () => {
    expect(vanishedRows(rows, new Set([1, 3]))).toEqual([{ id: 2, title: 'B', afterId: 1 }]);
  });

  it('setzt afterId null, wenn der erste Punkt verschwindet', () => {
    expect(vanishedRows(rows, new Set([2, 3]))).toEqual([{ id: 1, title: 'A', afterId: null }]);
  });

  it('überspringt gelöschte Vorgänger bei mehreren Löschungen', () => {
    // B und C weg → C hängt hinter A (B existiert nicht mehr).
    expect(vanishedRows(rows, new Set([1]))).toEqual([
      { id: 2, title: 'B', afterId: 1 },
      { id: 3, title: 'C', afterId: 1 },
    ]);
  });

  it('leerer voriger Stand → nichts (Erstaufbau)', () => {
    expect(vanishedRows([], new Set([1]))).toEqual([]);
  });
});
