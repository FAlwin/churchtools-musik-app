import { useMemo, useState } from 'react';
import type { SongLibraryEntry } from '@shared/types/index';
import type { SongUsageMap } from '../services/churchtoolsApi';
import { filterSongs, type SongSort } from '../utils/songFilter';

/**
 * Gemeinsamer Zustand für die Lied-Liste (Bibliothek UND Auswahl beim Hinzufügen/Verknüpfen):
 * Suche, Sortierung (A–Z/Häufigkeit/Zuletzt) und Zeitfilter (Von/Bis, leer = „Alle"). Die eigentliche
 * Filter-/Sortier-Rechnung liegt in `filterSongs` (rein, getestet).
 */
export function useSongFilter(
  songs: SongLibraryEntry[],
  usage: SongUsageMap | undefined,
  showStats: boolean,
  initialSort: SongSort = 'name',
) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SongSort>(initialSort);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const result = useMemo(
    () => filterSongs(songs, usage, { query: q, sort, from, to, showStats }),
    [songs, usage, q, sort, from, to, showStats],
  );

  return {
    q,
    setQ,
    sort,
    setSort,
    from,
    setFrom,
    to,
    setTo,
    allRange: !from && !to,
    ...result,
  };
}

export type UseSongFilter = ReturnType<typeof useSongFilter>;
