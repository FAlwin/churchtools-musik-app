import type { Service, SetlistSong } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import styles from './Setlist.module.scss';

interface SetlistProps {
  service: Service;
  songs: SetlistSong[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (index: number) => void;
  onBack: () => void;
}

/** Songliste eines Gottesdienstes mit Tonart-, BPM- und Taktart-Chips. */
export function Setlist({ service, songs, isLoading, isError, onRetry, onSelect, onBack }: SetlistProps) {
  return (
    <Screen>
      <NavBar
        title={service.name}
        subtitle={`${service.weekday}, ${service.day}. ${service.month} · ${service.time}`}
        left={<IconButton onClick={onBack}>‹</IconButton>}
      />
      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Setlist wird geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Setlist konnte nicht geladen werden." onRetry={onRetry} />
        ) : songs.length === 0 ? (
          <CenterMessage icon="🎵" text="Diese Setlist enthält keine Lieder." />
        ) : (
        <div className={styles.list}>
          {songs.map((song, i) => {
            const savedKey = localStorage.getItem(`worship_key_${song.id}`);
            const dispKey = savedKey || song.targetKey;
            return (
              <div key={i} className={styles.row} onClick={() => onSelect(i)}>
                <div className={styles.num}>{i + 1}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{song.title}</div>
                  <div className={styles.chips}>
                    <span className={styles.chipKey}>
                      {song.originalKey}
                      {song.originalKey !== dispKey && (
                        <>
                          <span className={styles.toArr}>→</span>
                          {dispKey}
                        </>
                      )}
                    </span>
                    {song.bpm !== null && <span className={styles.chipBpm}>♩ {song.bpm}</span>}
                    {song.timeSig && <span className={styles.timeSig}>{song.timeSig}</span>}
                  </div>
                </div>
                <span className={styles.arr}>›</span>
              </div>
            );
          })}
        </div>
        )}
        <div style={{ height: 20 }} />
      </Scroll>
    </Screen>
  );
}
