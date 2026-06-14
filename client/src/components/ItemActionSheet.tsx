import { useState } from 'react';
import type { AgendaItem, AgendaServiceOption } from '@shared/types/index';
import { Sheet } from './Sheet';
import { SongSearch } from './SongSearch';
import { ResponsibleField } from './ResponsibleField';
import styles from './ItemActionSheet.module.scss';

interface ItemActionSheetProps {
  item: AgendaItem;
  onClose: () => void;
  /** Punkt umbenennen (nur Nicht-Lieder). Wirft bei Fehler. */
  onRename: (title: string) => Promise<void>;
  /** Bestehenden Punkt mit einem Lied verknüpfen. Wirft bei Fehler. */
  onLinkSong: (arrangementId: number) => Promise<void>;
  /** Lied-Verknüpfung wieder aufheben (nur Lieder). Wirft bei Fehler. */
  onUnlinkSong: () => Promise<void>;
  /** Setzt das Verantwortlich-Textfeld (z.B. „[Musik]"). Wirft bei Fehler. */
  onSetResponsible: (responsible: string) => Promise<void>;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
}

type Mode = 'choose' | 'rename' | 'song' | 'responsible';

/** Aktionsmenü für einen Ablaufpunkt: Umbenennen, Lied verknüpfen oder Löschen. */
export function ItemActionSheet({
  item,
  onClose,
  onRename,
  onLinkSong,
  onUnlinkSong,
  onSetResponsible,
  services,
  onRequestDelete,
}: ItemActionSheetProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [title, setTitle] = useState(item.title);
  const [responsible, setResponsible] = useState(item.responsibleText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isSong = !!item.song;

  async function run(action: () => Promise<void>, fallbackMsg: string) {
    setBusy(true);
    setErr(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : fallbackMsg);
      setBusy(false);
    }
  }

  const heading =
    mode === 'rename'
      ? 'Umbenennen'
      : mode === 'song'
        ? 'Lied verknüpfen'
        : mode === 'responsible'
          ? 'Verantwortlich'
          : item.song
            ? item.song.title
            : item.title;

  return (
    <Sheet title={heading} onClose={onClose}>
      {err && <div className={styles.err}>{err}</div>}

      {mode === 'choose' && (
        <div className={styles.choices}>
          {!isSong && (
            <>
              <button className={styles.choice} onClick={() => setMode('rename')}>
                ✏️ Umbenennen
              </button>
              <button className={styles.choice} onClick={() => setMode('song')}>
                🎵 Lied verknüpfen
              </button>
            </>
          )}
          {isSong && (
            <button
              className={styles.choice}
              disabled={busy}
              onClick={() => run(onUnlinkSong, 'Verknüpfung aufheben fehlgeschlagen.')}
            >
              🔗 Verknüpfung aufheben
            </button>
          )}
          <button className={styles.choice} onClick={() => setMode('responsible')}>
            👤 Verantwortlich
          </button>
          <button
            className={`${styles.choice} ${styles.danger}`}
            onClick={() => {
              onClose();
              onRequestDelete();
            }}
          >
            🗑 Löschen
          </button>
        </div>
      )}

      {mode === 'rename' && (
        <div className={styles.form}>
          <input
            className={styles.input}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim() && title.trim() !== item.title) {
                run(() => onRename(title.trim()), 'Umbenennen fehlgeschlagen.');
              }
            }}
          />
          <button
            className={styles.primary}
            disabled={!title.trim() || title.trim() === item.title || busy}
            onClick={() => run(() => onRename(title.trim()), 'Umbenennen fehlgeschlagen.')}
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      )}

      {mode === 'song' && (
        <SongSearch
          autoFocus
          busy={busy}
          onPick={(arrangementId) => run(() => onLinkSong(arrangementId), 'Verknüpfen fehlgeschlagen.')}
        />
      )}

      {mode === 'responsible' && (
        <div className={styles.form}>
          <ResponsibleField autoFocus value={responsible} onChange={setResponsible} services={services} />
          <button
            className={styles.primary}
            disabled={busy || responsible === item.responsibleText}
            onClick={() => run(() => onSetResponsible(responsible.trim()), 'Speichern fehlgeschlagen.')}
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
