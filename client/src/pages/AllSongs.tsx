import { useState } from 'react';
import type { Service, SongLibraryEntry } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import { AddToAgendaSheet } from '../components/AddToAgendaSheet';
import { SongStatsBar } from '../components/SongStatsBar';
import { useSongFilter } from '../hooks/useSongFilter';
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
  /** Wenn true: pro Lied eine „+"-Aktion „Zu Ablauf hinzufügen". */
  canAddToAgenda?: boolean;
  /** Termine zur Auswahl beim Hinzufügen (kommende + vergangene). */
  services?: Service[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'noch nie';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Durchsuchbare Liste aller Lieder, sortierbar nach Name/Häufigkeit/zuletzt (+ Zeitfilter). */
export function AllSongs({
  songs,
  usage,
  usageLoading,
  showStats = false,
  isLoading,
  isError,
  onRetry,
  onSelect,
  canAddToAgenda = false,
  services = [],
}: AllSongsProps) {
  const [addSong, setAddSong] = useState<SongLibraryEntry | null>(null);
  const f = useSongFilter(songs, usage, showStats);
  const query = f.q.trim();

  return (
    <Screen>
      <NavBar title="Lieder" />

      <div className={styles.searchWrap}>
        <div className={styles.search}>
          <Icon name="search" size={18} stroke={2} className={styles.searchIcon} />
          <input
            placeholder="Lied oder Autor suchen…"
            value={f.q}
            onChange={(e) => f.setQ(e.target.value)}
          />
        </div>
        {showStats && <SongStatsBar {...f} />}
      </div>

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={onRetry} />
        ) : f.list.length === 0 ? (
          <CenterMessage
            icon="🎵"
            text={
              query
                ? `Keine Treffer für „${query}"`
                : f.statMode && !f.allRange
                  ? 'In diesem Zeitraum wurde kein Lied gespielt.'
                  : 'Keine Lieder gefunden.'
            }
          />
        ) : (
          <div className={styles.group}>
            <div className={styles.groupHdr}>{f.list.length} Lieder</div>
            <div className={styles.cardList}>
              {f.list.map((s) => {
                const st = f.stats.get(s.songId);
                return (
                  <div key={s.songId} className={styles.rowWrap}>
                    <button className={styles.row} onClick={() => onSelect(s)}>
                      <NoteTile />
                      <div className={styles.info}>
                        <div className={styles.name}>{s.name}</div>
                        {s.author && <div className={styles.sub}>{s.author}</div>}
                        {showStats && f.sort !== 'name' && (
                          <span className={styles.stat}>
                            {usageLoading
                              ? 'Statistik lädt…'
                              : f.sort === 'count'
                                ? `${st?.count ?? 0}× gespielt`
                                : `zuletzt ${fmtDate(st?.last ?? null)}`}
                          </span>
                        )}
                      </div>
                      {s.key && <span className={styles.keyPill}>{s.key}</span>}
                      <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
                    </button>
                    {canAddToAgenda && (
                      <button
                        className={styles.addBtn}
                        onClick={() => setAddSong(s)}
                        aria-label={`„${s.name}" zu einem Ablauf hinzufügen`}
                        title="Zu Ablauf hinzufügen"
                      >
                        <Icon name="plus" size={20} stroke={2.4} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </Scroll>

      {addSong && (
        <AddToAgendaSheet song={addSong} services={services} onClose={() => setAddSong(null)} />
      )}
    </Screen>
  );
}
