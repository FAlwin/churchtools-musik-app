import type { AgendaItem, Service } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar, IconButton } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import styles from './Setlist.module.scss';

interface SetlistProps {
  service: Service;
  items: AgendaItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Wird mit dem Index des Lieds (nur Lieder gezählt) aufgerufen. */
  onSelect: (songIndex: number) => void;
  onBack: () => void;
}

/** Kompletter Ablauf eines Gottesdienstes: Lieder anklickbar, übrige Punkte mitgelistet. */
export function Setlist({ service, items, isLoading, isError, onRetry, onSelect, onBack }: SetlistProps) {
  // Laufender Zähler über die Lieder – für die Charts-Navigation (Index ins Songs-Array).
  let songIndex = -1;

  return (
    <Screen>
      <NavBar
        title={service.name}
        subtitle={`${service.weekday}, ${service.day}. ${service.month} · ${service.time}`}
        left={<IconButton onClick={onBack}>‹</IconButton>}
      />
      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Ablauf wird geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Ablauf konnte nicht geladen werden." onRetry={onRetry} />
        ) : items.length === 0 ? (
          <CenterMessage icon="📋" text="Dieser Ablauf enthält noch keine Punkte." />
        ) : (
          <div className={styles.list}>
            {items.map((item) => {
              // Überschrift / Abschnitt
              if (item.isHeader) {
                return (
                  <div key={item.id} className={styles.header}>
                    {item.title}
                  </div>
                );
              }

              // Lied – anklickbar mit Chips
              if (item.song) {
                songIndex += 1;
                const idx = songIndex;
                const song = item.song;
                const savedKey = localStorage.getItem(`worship_key_${song.id}`);
                const dispKey = savedKey || song.targetKey;
                return (
                  <div key={item.id} className={styles.row} onClick={() => onSelect(idx)}>
                    <div className={styles.num}>{idx + 1}</div>
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
              }

              // Sonstiger Ablaufpunkt – dezent, nicht anklickbar
              return (
                <div key={item.id} className={styles.itemRow}>
                  <span className={styles.bullet} />
                  <div className={styles.itemTitle}>{item.title}</div>
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
