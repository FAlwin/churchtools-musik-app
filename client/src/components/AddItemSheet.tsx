import { useState } from 'react';
import type { AgendaServiceOption } from '@shared/types/index';
import { Sheet } from './Sheet';
import { SongSearch } from './SongSearch';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from './icons';
import styles from './AddItemSheet.module.scss';

interface AddItemSheetProps {
  onClose: () => void;
  /** Legt einen Punkt an. Wirft bei Fehler (z.B. fehlende Rechte). */
  onAdd: (data: {
    type: 'header' | 'text' | 'song';
    title?: string;
    arrangementId?: number;
    responsible?: string;
    note?: string;
  }) => Promise<void>;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Feld). */
  services: AgendaServiceOption[];
}

type Mode = 'choose' | 'header' | 'text' | 'song';

/** Sheet zum Hinzufügen eines Ablaufpunkts: Überschrift, Text oder Lied (per Songsuche). */
export function AddItemSheet({ onClose, onAdd, services }: AddItemSheetProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [title, setTitle] = useState('');
  const [responsible, setResponsible] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(data: Parameters<typeof onAdd>[0]) {
    setBusy(true);
    setErr(null);
    try {
      await onAdd(data);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hinzufügen fehlgeschlagen.');
      setBusy(false);
    }
  }

  const titleText =
    mode === 'header'
      ? 'Überschrift hinzufügen'
      : mode === 'text'
        ? 'Eintrag hinzufügen'
        : mode === 'song'
          ? 'Lied hinzufügen'
          : 'Hinzufügen';

  return (
    <Sheet title={titleText} onClose={onClose}>
      {err && <div className={styles.err}>{err}</div>}

      {mode === 'choose' && (
        <div className={styles.choices}>
          <button className={styles.choice} onClick={() => setMode('song')}>
            <Icon name="music" size={20} className={styles.choiceIcon} />
            <span>Lied</span>
          </button>
          <button className={styles.choice} onClick={() => setMode('header')}>
            <Icon name="heading" size={20} className={styles.choiceIcon} />
            <span>Überschrift</span>
          </button>
          <button className={styles.choice} onClick={() => setMode('text')}>
            <Icon name="type" size={20} className={styles.choiceIcon} />
            <span>Text</span>
          </button>
        </div>
      )}

      {(mode === 'header' || mode === 'text') && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder={mode === 'header' ? 'Titel der Überschrift' : 'Titel des Eintrags'}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim())
                add({
                  type: mode,
                  title: title.trim(),
                  responsible: responsible.trim() || undefined,
                  note: note.trim() || undefined,
                });
            }}
          />
          {mode === 'text' && (
            <>
              <ResponsibleField value={responsible} onChange={setResponsible} services={services} />
              <textarea
                className={styles.textarea}
                value={note}
                rows={2}
                placeholder="Bemerkung (optional)"
                onChange={(e) => setNote(e.target.value)}
              />
            </>
          )}
          <button
            className={styles.primary}
            disabled={!title.trim() || busy}
            onClick={() =>
              add({
                type: mode,
                title: title.trim(),
                responsible: responsible.trim() || undefined,
                note: note.trim() || undefined,
              })
            }
          >
            {busy ? 'Füge hinzu…' : 'Hinzufügen'}
          </button>
        </div>
      )}

      {mode === 'song' && (
        <SongSearch
          autoFocus
          busy={busy}
          onPick={(arrangementId, songName) =>
            add({ type: 'song', title: songName, arrangementId })
          }
        />
      )}
    </Sheet>
  );
}
