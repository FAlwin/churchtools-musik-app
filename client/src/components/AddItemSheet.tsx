import { useState } from 'react';
import type { AgendaServiceOption } from '@shared/types/index';
import { Sheet } from './Sheet';
import { SongPicker } from './SongPicker';
import { NewSongSheet } from './NewSongSheet';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from './icons';
import { useCapabilities } from '../hooks/useServices';
import styles from './AddItemSheet.module.scss';

interface AddItemSheetProps {
  /** Termin, dessen Ablauf ergänzt wird – ein neu angelegtes Lied geht direkt hinein (#322). */
  eventId: number;
  /** Name des Termins – für den Satz in der Erfolgsansicht von „Neues Lied". */
  eventName?: string;
  onClose: () => void;
  /** Legt einen Punkt an. Wirft bei Fehler (z.B. fehlende Rechte). */
  onAdd: (data: {
    type: 'header' | 'text' | 'song';
    title?: string;
    arrangementId?: number;
    responsible?: string;
    note?: string;
    durationMin?: number;
  }) => Promise<void>;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Feld). */
  services: AgendaServiceOption[];
}

type Mode = 'choose' | 'header' | 'text' | 'song';

/** Sheet zum Hinzufügen eines Ablaufpunkts: Überschrift, Text oder Lied (per Songsuche). */
export function AddItemSheet({ eventId, eventName, onClose, onAdd, services }: AddItemSheetProps) {
  const [mode, setMode] = useState<Mode>('choose');
  /** „Neues Lied" ersetzt dieses Blatt, statt sich darüberzulegen – zwei Dialoge übereinander. */
  const [neuesLied, setNeuesLied] = useState(false);
  const canEditSongs = useCapabilities(true).data?.canEditSongs ?? false;
  const [title, setTitle] = useState('');
  const [responsible, setResponsible] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const durationNum = duration.trim() === '' ? null : Number(duration);
  const durationValid = durationNum === null || (Number.isInteger(durationNum) && durationNum >= 0);

  /** Baut die Payload für einen Text-/Überschrift-Punkt (Dauer nur bei gültiger Eingabe). */
  function textPayload(): Parameters<typeof onAdd>[0] {
    return {
      type: mode as 'header' | 'text',
      title: title.trim(),
      responsible: responsible.trim() || undefined,
      note: note.trim() || undefined,
      durationMin: durationNum !== null ? durationNum : undefined,
    };
  }

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

  /**
   * Ein neues Lied wird direkt in diesen Ablauf eingetragen – das macht der Server in einem Zug
   * (`eventId` im Auftrag). Deshalb wird `onAdd` danach **nicht** noch aufgerufen: Der Punkt stünde
   * sonst zweimal im Ablauf.
   *
   * **Warum es diesen Einstieg nur hier gibt und nicht auch in `ItemActionSheet`:** Dort wird einem
   * **vorhandenen** Ablaufpunkt ein Lied zugeordnet. Ein neu angelegtes Lied müsste in diesen Punkt
   * hineingeschrieben werden – der Auftrag legt aber mit `eventId` einen **neuen** Punkt an. Der
   * Einstieg dort bräuchte also einen anderen Schreibweg; er fehlt nicht aus Versehen.
   */
  if (neuesLied) {
    return <NewSongSheet eventId={eventId} eventName={eventName} onClose={onClose} />;
  }

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
          <div className={styles.field}>
            <span className={styles.label}>Titel</span>
            <input
              className={styles.input}
              placeholder={mode === 'header' ? 'Titel der Überschrift' : 'Titel'}
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim() && durationValid) void add(textPayload());
              }}
            />
          </div>
          {mode === 'text' && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Dauer (Minuten)</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={duration}
                  placeholder="z. B. 5"
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Zuständig</span>
                <ResponsibleField
                  value={responsible}
                  onChange={setResponsible}
                  services={services}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Bemerkung</span>
                <textarea
                  className={styles.textarea}
                  value={note}
                  rows={2}
                  placeholder="Optionale Notiz…"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          )}
          <button
            className={styles.primary}
            disabled={!title.trim() || busy || !durationValid}
            onClick={() => add(textPayload())}
          >
            {busy ? 'Füge hinzu…' : 'Hinzufügen'}
          </button>
        </div>
      )}

      {mode === 'song' && (
        <>
          {/* Steht ÜBER der Liste, weil man hier landet, wenn man das Lied darin nicht findet –
              und nur mit dem ChurchTools-Recht, Lieder zu bearbeiten (#322). */}
          {canEditSongs && (
            <button className={styles.choice} onClick={() => setNeuesLied(true)}>
              <Icon name="plus" size={20} className={styles.choiceIcon} />
              <span>Neues Lied anlegen …</span>
            </button>
          )}
          <SongPicker
            autoFocus
            busy={busy}
            onPick={(arrangementId, songName) =>
              add({ type: 'song', title: songName, arrangementId })
            }
          />
        </>
      )}
    </Sheet>
  );
}
