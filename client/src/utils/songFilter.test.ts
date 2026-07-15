import { describe, it, expect } from 'vitest';
import type { SongLibraryEntry } from '@shared/types/index';
import type { SongUsageMap } from '../services/churchtoolsApi';
import { filterSongs, type SongFilterOpts } from './songFilter';

const SONGS: SongLibraryEntry[] = [
  { songId: 1, name: 'Anker', author: 'Autor X', key: 'C', arrangementId: 11 },
  { songId: 2, name: 'Berg', author: 'Autor Y', key: 'D', arrangementId: 22 },
  { songId: 3, name: 'Cedar', author: null, key: null, arrangementId: 33 },
];

// Termine absteigend (neuester zuerst), wie vom Server geliefert.
const USAGE: SongUsageMap = {
  '1': { dates: ['2026-06-01', '2026-01-10'] },
  '2': { dates: ['2026-07-01', '2026-05-01', '2026-04-01'] },
  // Song 3 wurde nie gespielt (kein Eintrag).
};

const opts = (o: Partial<SongFilterOpts>): SongFilterOpts => ({
  query: '',
  sort: 'name',
  from: '',
  to: '',
  showStats: true,
  ...o,
});

const names = (list: SongLibraryEntry[]) => list.map((s) => s.name);

describe('filterSongs', () => {
  it('A–Z zeigt alle Lieder alphabetisch und ignoriert den Zeitraum', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'name', from: '2026-06-01', to: '2026-06-30' }));
    expect(names(r.list)).toEqual(['Anker', 'Berg', 'Cedar']);
    expect(r.statMode).toBe(false);
  });

  it('Häufigkeit: nur im Zeitraum gespielte Lieder, nach Anzahl absteigend', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count', from: '2026-05-01' }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']); // Berg 2×, Anker 1× ab 2026-05-01
    expect(r.list.find((s) => s.name === 'Cedar')).toBeUndefined(); // nie gespielt → raus
    expect(r.stats.get(2)?.count).toBe(2);
    expect(r.stats.get(1)?.count).toBe(1);
    expect(r.statMode).toBe(true);
  });

  it('Zuletzt: sortiert nach jüngstem Spieldatum, ungespielte fallen raus', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'recent' }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']); // Berg zuletzt 2026-07-01, Anker 2026-06-01
    expect(r.stats.get(2)?.last).toBe('2026-07-01');
    expect(r.stats.get(1)?.last).toBe('2026-06-01');
  });

  it('leerer Zeitraum („Alle") berücksichtigt alle Termine', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count' }));
    expect(r.stats.get(1)?.count).toBe(2); // beide Termine von Song 1
    expect(r.stats.get(2)?.count).toBe(3);
  });

  it('Suche filtert nach Name und Autor', () => {
    expect(names(filterSongs(SONGS, USAGE, opts({ query: 'berg' })).list)).toEqual(['Berg']);
    expect(names(filterSongs(SONGS, USAGE, opts({ query: 'autor x' })).list)).toEqual(['Anker']);
  });

  it('ohne Statistik-Recht bleibt es reines A–Z (kein statMode, alle Lieder)', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count', showStats: false }));
    expect(r.statMode).toBe(false);
    expect(r.list.length).toBe(3);
  });
});
