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
  /**
   * Ob die Statistik überhaupt **verfügbar** ist (#300). `false` = der Server konnte die Zahlen nicht
   * liefern (ChurchTools drosselt gerade).
   *
   * Wichtig: Dann darf NICHT nach „im Zeitraum gespielt" gefiltert werden – sonst wäre die Liederliste
   * komplett leer und behauptete „In diesem Zeitraum wurde kein Lied gespielt", obwohl wir es nur nicht
   * wissen. Fehlende Zahlen sind etwas anderes als die Zahl 0.
   */
  usageAvailable?: boolean;
  /** Ob Statistik/Zeitfilter überhaupt greifen (sonst reines A–Z). */
  showStats: boolean;
}

/** Häufigkeit + letztes Spieldatum eines Lieds im gewählten Zeitraum. */
interface SongStat {
  count: number;
  last: string | null;
}

interface SongFilterResult {
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
        (s) =>
          s.name.toLowerCase().includes(query) || (s.author ?? '').toLowerCase().includes(query),
      )
    : [...songs];

  const withStat = searched.map((s) => [s, statOf(s)] as const);
  // Bei Häufigkeit/Zuletzt nur im Zeitraum gespielte Lieder zeigen – aber NUR, wenn wir die Zahlen
  // wirklich haben (#300). Fehlt die Statistik, bleiben alle Lieder stehen (unsortiert nach Namen).
  const statistikDa = opts.usageAvailable !== false;
  const visible = statMode && statistikDa ? withStat.filter(([, st]) => st.count > 0) : withStat;

  /**
   * **Titel-Treffer zuerst** (Wunsch Alwin, 13.08.2026).
   *
   * Gesucht wird in Titel **und** Autor. Vorher stand die Liste rein alphabetisch – ein Lied, das das
   * Wort nur im Autor trug, konnte damit vor dem stehen, das es im Titel hat. Wer „Gnade" tippt, meint
   * fast immer den Titel.
   *
   * `0` = Treffer im Titel, `1` = nur im Autor.
   *
   * **Ohne Suche braucht es keinen Sonderfall:** `''.includes('')` ist `true`, also bekommen dann alle
   * Lieder `0` und es bleibt bei der reinen Alphabetik. Ein zusätzliches `!query ||` stand hier zuerst –
   * die Gegenprobe entlarvte es als wirkungslos: Der Test blieb auch ohne die Bedingung grün, weil der
   * Code sie nie braucht. Eine Bedingung, die nichts entscheidet, behauptet eine Regel, die es nicht
   * gibt.
   */
  const trefferArt = (s: SongLibraryEntry): number =>
    s.name.toLowerCase().includes(query) ? 0 : 1;

  visible.sort(([a, sa], [b, sb]) => {
    /**
     * **Nur bei „A–Z".** Bei Häufigkeit und Zuletzt müssen die Zahlen gewinnen, sonst wäre der
     * Umschalter wirkungslos: Ein zehnmal gespieltes Lied gehört nach vorn, auch wenn das Wort bei ihm
     * im Autor steht. Die Trefferart bleibt dort der Tie-Break vor dem Namen – siehe unten.
     */
    if (opts.sort === 'count') {
      return (
        sb.count - sa.count || trefferArt(a) - trefferArt(b) || a.name.localeCompare(b.name, 'de')
      );
    }
    if (opts.sort === 'recent') {
      return (
        (sb.last ?? '').localeCompare(sa.last ?? '') ||
        trefferArt(a) - trefferArt(b) ||
        a.name.localeCompare(b.name, 'de')
      );
    }
    return trefferArt(a) - trefferArt(b) || a.name.localeCompare(b.name, 'de');
  });

  return {
    list: visible.map(([s]) => s),
    stats: new Map(visible.map(([s, st]) => [s.songId, st])),
    statMode,
  };
}

/**
 * Der Statistik-Text neben einem Lied – EINE Stelle für beide Listen (#300).
 *
 * Stand vorher wortgleich in `AllSongs.tsx` und `SongPicker.tsx` und lautete `${st?.count ?? 0}×
 * gespielt`. Damit behauptete eine **fehlende** Statistik „0× gespielt" bzw. „zuletzt: noch nie" –
 * eine falsche Aussage über die Gemeinde-Historie. Fehlende Zahlen sind nicht die Zahl 0.
 */
export function statLabel(
  sort: SongSort,
  st: SongStat | undefined,
  state: 'ok' | 'loading' | 'error',
): string {
  if (state === 'loading') return 'Statistik lädt…';
  if (state === 'error') return '–';
  if (sort === 'recent') return `zuletzt: ${fmtPlayDate(st?.last ?? null)}`;
  return `${st?.count ?? 0}× gespielt`;
}
