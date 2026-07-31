/**
 * Lied-Menü der Chart-Ansicht (#198 – vorher inline in `pages/ChordChart.tsx`, ~190 Zeilen JSX).
 *
 * Vier Gruppen: Tonart/Kapo/Abschnitte, Teilen/Bearbeiten, **Anzeige** (Akkorde & Text · Nur Text ·
 * hochgeladene Dokumente) und **Version**.
 *
 * Das Menü **schließt sich selbst** nach jeder Auswahl. Vorher stand `setShowSongMenu(false)` elf Mal
 * in den Klick-Handlern; ein vergessener Aufruf hätte das Menü offen über der Änderung stehen lassen.
 * Die Rückrufe hier sind reine Aktionen und müssen sich um das Schließen nicht kümmern.
 */
import type { SetlistSong, ChordProSection } from '@shared/types/index';
import type { SongSettings } from '../utils/chartSettings';
import { Icon } from '../components/icons';
import { hasStoredNotesForLevel as hasOwnNotes } from '../utils/annotationKeys';
import styles from '../pages/ChordChart.module.scss';

/** Eine wählbare Fassung des Lieds (Original oder benannte Version). */
interface VersionChoice {
  key: string;
  name: string;
}

interface SongMenuProps {
  song: SetlistSong;
  set: SongSettings;
  /** Klingende Tonart, wie sie im Menü neben „Transponieren" steht. */
  curKey: string;
  /** Abschnitte des angezeigten Textes – ohne sie gibt es nichts zu transponieren/teilen. */
  sections: ChordProSection[];
  versions: VersionChoice[];
  currentVersion: VersionChoice;
  isOriginal: boolean;
  hasVersions: boolean;
  canEditSong: boolean;
  onClose: () => void;
  onOpenKeyPicker: () => void;
  onOpenCapoPicker: () => void;
  onOpenSectionTranspose: () => void;
  onSharePdf: () => void;
  onEditCurrent: () => void;
  onNewVersion: () => void;
  onDeleteVersion: () => void;
  onChange: (patch: Partial<SongSettings>) => void;
  onSelectVersion: (versionKey: string) => void;
}

export function SongMenu({
  song,
  set,
  curKey,
  sections,
  versions,
  currentVersion,
  isOriginal,
  hasVersions,
  canEditSong,
  onClose,
  onOpenKeyPicker,
  onOpenCapoPicker,
  onOpenSectionTranspose,
  onSharePdf,
  onEditCurrent,
  onNewVersion,
  onDeleteVersion,
  onChange,
  onSelectVersion,
}: SongMenuProps) {
  /** Jede Auswahl schließt das Menü – siehe Kopfkommentar. */
  const pick = (action: () => void) => () => {
    action();
    onClose();
  };
  const showsChords = set.viewSource === 'chords';

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.modeMenu}>
        <button className={styles.mmItem} onClick={pick(onOpenKeyPicker)}>
          <span>Transponieren</span>
          <span className={styles.mmValueActive}>{curKey}</span>
        </button>
        <button className={styles.mmItem} onClick={pick(onOpenCapoPicker)}>
          <span>Kapo</span>
          {set.capo > 0 ? (
            <span className={styles.mmValueActive}>Bund {set.capo}</span>
          ) : (
            <span className={styles.mmValue}>–</span>
          )}
        </button>
        {showsChords && (
          <button className={styles.mmItem} onClick={pick(onOpenSectionTranspose)}>
            <span>Abschnitte transponieren</span>
            {Object.keys(set.secShift).length > 0 ? (
              <span className={styles.mmValueActive}>{Object.keys(set.secShift).length} aktiv</span>
            ) : (
              <span className={styles.mmValue}>–</span>
            )}
          </button>
        )}
        {showsChords && sections.length > 0 && (
          <button className={styles.mmItem} onClick={pick(onSharePdf)}>
            <span>Als PDF teilen</span>
            <span className={styles.mmValue}>⤴</span>
          </button>
        )}
        {canEditSong && showsChords && (
          <button className={styles.mmItem} onClick={pick(onEditCurrent)}>
            <span>
              {isOriginal ? 'Bearbeiten (neue Version)' : `„${currentVersion.name}" bearbeiten`}
            </span>
            <span className={styles.mmValue}>🖉</span>
          </button>
        )}

        <div className={styles.menuLbl} style={{ marginTop: 6 }}>
          Anzeige
        </div>
        <button
          className={`${styles.mmItem}${showsChords && !set.lyricsOnly ? ' ' + styles.on : ''}`}
          onClick={pick(() => onChange({ viewSource: 'chords', lyricsOnly: false }))}
        >
          <span>
            Akkorde &amp; Text
            {hasOwnNotes(song.id, set.versionKey, false) && (
              <Icon name="pencil" size={12} className={styles.mmNote} />
            )}
          </span>
          {showsChords && !set.lyricsOnly && <span className={styles.mmCheck}>✓</span>}
        </button>
        <button
          className={`${styles.mmItem}${showsChords && set.lyricsOnly ? ' ' + styles.on : ''}`}
          onClick={pick(() => onChange({ viewSource: 'chords', lyricsOnly: true }))}
        >
          <span>
            Nur Text
            {hasOwnNotes(song.id, set.versionKey, true) && (
              <Icon name="pencil" size={12} className={styles.mmNote} />
            )}
          </span>
          {showsChords && set.lyricsOnly && <span className={styles.mmCheck}>✓</span>}
        </button>
        {song.documents.map((d) => (
          <button
            key={d.fileId}
            className={`${styles.mmItem}${set.viewSource === d.fileId ? ' ' + styles.on : ''}`}
            onClick={pick(() => onChange({ viewSource: d.fileId }))}
          >
            <span>
              {d.type === 'pdf' ? '📄' : '🖼️'} {d.name}
            </span>
            {set.viewSource === d.fileId && <span className={styles.mmCheck}>✓</span>}
          </button>
        ))}

        {showsChords && (hasVersions || canEditSong) && (
          <>
            <div className={styles.menuLbl} style={{ marginTop: 6 }}>
              Version
            </div>
            {versions.map((v) => (
              <button
                key={v.key}
                className={`${styles.mmItem}${set.versionKey === v.key ? ' ' + styles.on : ''}`}
                onClick={pick(() => onSelectVersion(v.key))}
              >
                <span>
                  {v.name}
                  {(hasOwnNotes(song.id, v.key, false) || hasOwnNotes(song.id, v.key, true)) && (
                    <Icon name="pencil" size={12} className={styles.mmNote} />
                  )}
                </span>
                {set.versionKey === v.key && <span className={styles.mmCheck}>✓</span>}
              </button>
            ))}
            {canEditSong && (
              <button className={styles.mmItem} onClick={pick(onNewVersion)}>
                <span>Neue Version…</span>
                <span className={styles.mmValue}>＋</span>
              </button>
            )}
            {canEditSong && !isOriginal && (
              <button className={styles.mmItem} onClick={pick(onDeleteVersion)}>
                <span className={styles.mmDanger}>„{currentVersion.name}" löschen</span>
                <span className={styles.mmValue}>🗑</span>
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
