import { useState } from 'react';
import type { SongLibraryEntry } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import type { SongUsageMap } from '../services/churchtoolsApi';
import styles from './AllSongs.module.scss';

interface AllSongsProps {
  songs: SongLibraryEntry[];
  /** Nutzungsdaten je Song-ID (lädt im Hintergrund nach). */
  usage?: SongUsageMap;
  usageLoading?: boolean;
  /** Statistik (Häufigkeit/zuletzt + entsprechende Sortierung) anzeigen? */
  showStats?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (entry: SongLibraryEntry) => void;
  /** Zurück zur Übersicht – nur wenn der Nutzer Abläufe sehen darf. */
  onBack?: () => void;
  onLogout?: () => void;
}

type Sort = 'name' | 'count' | 'recent';

/** Formatiert ein ISO-Datum als TT.MM.JJJJ (oder „noch nie"). */
function fmtDate(iso: string | null): string {
  if (!iso) return 'noch nie';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Durchsuchbare Liste aller Lieder, sortierbar nach Name/Häufigkeit/zuletzt. */
export function AllSongs({
  songs,
  usage,
  usageLoading,
  showStats = false,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onBack,
  onLogout,
}: AllSongsProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const query = q.trim().toLowerCase();

  const countOf = (s: SongLibraryEntry) => usage?.[s.songId]?.count ?? 0;
  const lastOf = (s: SongLibraryEntry) => usage?.[s.songId]?.lastUsed ?? s.lastUsed;

  const filtered = (
    query
      ? songs.filter(
          (s) => s.name.toLowerCase().includes(query) || (s.author ?? '').toLowerCase().includes(query),
        )
      : [...songs]
  ).sort((a, b) => {
    if (sort === 'count') return countOf(b) - countOf(a) || a.name.localeCompare(b.name, 'de');
    if (sort === 'recent') return (lastOf(b) ?? '').localeCompare(lastOf(a) ?? '') || a.name.localeCompare(b.name, 'de');
    return a.name.localeCompare(b.name, 'de');
  });

  return (
    <Screen>
      <NavBar
        title="Lieder"
        subtitle="ECG Donrath"
        left={onBack ? <IconButton onClick={onBack}>‹</IconButton> : undefined}
        right={
          onLogout ? (
            <IconButton onClick={onLogout} title="Abmelden" style={{ fontSize: 18 }}>
              ⏻
            </IconButton>
          ) : undefined
        }
      />

      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          placeholder="Lied oder Autor suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {showStats && (
          <div className={styles.sortRow}>
            <button
              className={`${styles.sortBtn}${sort === 'name' ? ' ' + styles.sortOn : ''}`}
              onClick={() => setSort('name')}
            >
              A–Z
            </button>
            <button
              className={`${styles.sortBtn}${sort === 'count' ? ' ' + styles.sortOn : ''}`}
              onClick={() => setSort('count')}
            >
              Häufigkeit
            </button>
            <button
              className={`${styles.sortBtn}${sort === 'recent' ? ' ' + styles.sortOn : ''}`}
              onClick={() => setSort('recent')}
            >
              Zuletzt
            </button>
          </div>
        )}
      </div>

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={onRetry} />
        ) : filtered.length === 0 ? (
          <CenterMessage icon="🎵" text={query ? 'Keine Treffer.' : 'Keine Lieder gefunden.'} />
        ) : (
          <div className={styles.list}>
            <div className={styles.count}>{filtered.length} Lieder</div>
            {filtered.map((s) => (
              <div key={s.songId} className={styles.row} onClick={() => onSelect(s)}>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{s.name}</span>
                    {s.key && <span className={styles.keyTag}>{s.key}</span>}
                  </div>
                  {s.author && <div className={styles.author}>{s.author}</div>}
                  {showStats && (
                    <div className={styles.stats}>
                      {usageLoading ? (
                        <span className={styles.statsLoading}>Statistik lädt…</span>
                      ) : (
                        <>
                          <span className={styles.countBadge}>{countOf(s)}×&nbsp;gespielt</span>
                          <span className={styles.last}>zuletzt {fmtDate(lastOf(s))}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className={styles.arr}>›</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 20 }} />
      </Scroll>
    </Screen>
  );
}
