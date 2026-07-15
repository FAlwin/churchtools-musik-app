import type { SongLibraryEntry } from '@shared/types/index';
import type { SongUsageMap } from '../services/churchtoolsApi';

export type SongSort = 'name' | 'count' | 'recent';

/** Formatiert ein ISO-Datum (YYYY-MM-DD) als TT.MM.JJJJ; null → „noch nie". */
export function fmtPlayDate(iso: string | null): string {
  if (!iso) return 'noch nie';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export interface SongFilterOpts {
  /** Freitext (Name/Autor). */
  query: string;
  sort: SongSort;
  /** Zeitraumgrenzen (YYYY-MM-DD), leer = offen. Nur für Häufigkeit/Zuletzt. */
  from: string;
  to: string;
  /** Ob Statistik/Zeitfilter überhaupt greifen (sonst reines A–Z). */
  showStats: boolean;
}

/** Häufigkeit + letztes Spieldatum eines Lieds im gewählten Zeitraum. */
export interface SongStat {
  count: number;
  last: string | null;
}

export interface SongFilterResult {
  list: SongLibraryEntry[];
  stats: Map<number, SongStat>;
  /** true, wenn nach Häufigkeit/Zuletzt gefiltert/sortiert wird (Statistik sichtbar). */
  statMode: boolean;
}

/**
 * Filtert + sortiert die Liederliste. Bei „Häufigkeit"/„Zuletzt" (statMode) werden nur Lieder
 * berücksichtigt, die im Zeitraum [from,to] gespielt wurden; bei „A–Z" bleiben alle Lieder und der
 * Zeitraum wird ignoriert. Rein (keine React-Abhängigkeit) → in songFilter.test.ts abgesichert.
 */
export function filterSongs(
  songs: SongLibraryEntry[],
  usage: SongUsageMap | undefined,
  opts: SongFilterOpts,
): SongFilterResult {
  const statMode = opts.showStats && opts.sort !== 'name';
  const inRange = (d: string) => (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to);
  const statOf = (s: SongLibraryEntry): SongStat => {
    // Termine kommen absteigend sortiert vom Server → das erste im Zeitraum ist das jüngste.
    const dates = (usage?.[s.songId]?.dates ?? []).filter(inRange);
    return { count: dates.length, last: dates[0] ?? null };
  };

  const query = opts.query.trim().toLowerCase();
  const searched = query
    ? songs.filter(
        (s) => s.name.toLowerCase().includes(query) || (s.author ?? '').toLowerCase().includes(query),
      )
    : [...songs];

  const withStat = searched.map((s) => [s, statOf(s)] as const);
  // Bei Häufigkeit/Zuletzt nur im Zeitraum gespielte Lieder zeigen.
  const visible = statMode ? withStat.filter(([, st]) => st.count > 0) : withStat;

  visible.sort(([a, sa], [b, sb]) => {
    if (opts.sort === 'count') return sb.count - sa.count || a.name.localeCompare(b.name, 'de');
    if (opts.sort === 'recent')
      return (sb.last ?? '').localeCompare(sa.last ?? '') || a.name.localeCompare(b.name, 'de');
    return a.name.localeCompare(b.name, 'de');
  });

  return {
    list: visible.map(([s]) => s),
    stats: new Map(visible.map(([s, st]) => [s.songId, st])),
    statMode,
  };
}
