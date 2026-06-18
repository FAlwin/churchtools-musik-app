import { useState } from 'react';
import type { SongLibraryEntry } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import type { SongUsageMap } from '../services/churchtoolsApi';
import styles from './AllSongs.module.scss';

interface AllSongsProps {
  songs: SongLibraryEntry[];
  usage?: SongUsageMap;
  usageLoading?: boolean;
  showStats?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (entry: SongLibraryEntry) => void;
}

type Sort = 'name' | 'count' | 'recent';

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
}: AllSongsProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const query = q.trim().toLowerCase();

  const countOf = (s: SongLibraryEntry) => usage?.[s.songId]?.count ?? 0;
  const lastOf = (s: SongLibraryEntry) => usage?.[s.songId]?.lastUsed ?? null;

  const filtered = (
    query
      ? songs.filter(
          (s) => s.name.toLowerCase().includes(query) || (s.author ?? '').toLowerCase().includes(query),
        )
      : [...songs]
  ).sort((a, b) => {
    if (sort === 'count') return countOf(b) - countOf(a) || a.name.localeCompare(b.name, 'de');
    if (sort === 'recent')
      return (lastOf(b) ?? '').localeCompare(lastOf(a) ?? '') || a.name.localeCompare(b.name, 'de');
    return a.name.localeCompare(b.name, 'de');
  });

  const SORTS: { id: Sort; label: string }[] = [
    { id: 'name', label: 'A–Z' },
    { id: 'count', label: 'Häufigkeit' },
    { id: 'recent', label: 'Zuletzt' },
  ];

  return (
    <Screen>
      <NavBar title="Lieder" />

      <div className={styles.searchWrap}>
        <div className={styles.search}>
          <Icon name="search" size={18} stroke={2} className={styles.searchIcon} />
          <input placeholder="Lied oder Autor suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {showStats && (
          <div className={styles.seg}>
            {SORTS.map((s) => (
              <button
                key={s.id}
                className={`${styles.segBtn}${sort === s.id ? ' ' + styles.segOn : ''}`}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={onRetry} />
        ) : filtered.length === 0 ? (
          <CenterMessage icon="🎵" text={query ? `Keine Treffer für „${q}"` : 'Keine Lieder gefunden.'} />
        ) : (
          <div className={styles.group}>
            <div className={styles.groupHdr}>{filtered.length} Lieder</div>
            <div className={styles.cardList}>
              {filtered.map((s) => (
                <button key={s.songId} className={styles.row} onClick={() => onSelect(s)}>
                  <NoteTile />
                  <div className={styles.info}>
                    <div className={styles.name}>{s.name}</div>
                    {s.author && <div className={styles.sub}>{s.author}</div>}
                    {showStats && sort !== 'name' && (
                      <span className={styles.stat}>
                        {usageLoading
                          ? 'Statistik lädt…'
                          : sort === 'count'
                            ? `${countOf(s)}× gespielt`
                            : `zuletzt ${fmtDate(lastOf(s))}`}
                      </span>
                    )}
                  </div>
                  {s.key && <span className={styles.keyPill}>{s.key}</span>}
                  <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </Scroll>
    </Screen>
  );
}
