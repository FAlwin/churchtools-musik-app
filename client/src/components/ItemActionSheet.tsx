import { useState } from 'react';
import type { AgendaItem, AgendaServiceOption } from '@shared/types/index';
import { Sheet } from './Sheet';
import { SongSearch } from './SongSearch';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from './icons';
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
  /** Setzt die Dauer des Punkts in Minuten (CT berechnet die Uhrzeiten neu). Wirft bei Fehler. */
  onSetDuration: (durationMin: number) => Promise<void>;
  /** Ist die Uhrzeit dieses Punkts in der App ausgeblendet? */
  timeHidden: boolean;
  /** Blendet die Uhrzeit dieses Punkts in der App aus/ein (lokal, kein ChurchTools-Schreibzugriff). */
  onToggleTimeHidden: () => void;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
}

type Mode = 'choose' | 'rename' | 'song' | 'responsible' | 'duration';

/** Aktionsmenü für einen Ablaufpunkt: Umbenennen, Lied verknüpfen oder Löschen. */
export function ItemActionSheet({
  item,
  onClose,
  onRename,
  onLinkSong,
  onUnlinkSong,
  onSetResponsible,
  onSetDuration,
  timeHidden,
  onToggleTimeHidden,
  services,
  onRequestDelete,
}: ItemActionSheetProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [title, setTitle] = useState(item.title);
  const [responsible, setResponsible] = useState(item.responsibleText);
  const [duration, setDuration] = useState(
    item.durationMin != null ? String(item.durationMin) : '',
  );
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
          : mode === 'duration'
            ? 'Dauer'
            : item.song
              ? item.song.title
              : item.title;

  const durationNum = duration.trim() === '' ? null : Number(duration);
  const durationValid = durationNum !== null && Number.isInteger(durationNum) && durationNum >= 0;

  return (
    <Sheet title={heading} onClose={onClose}>
      {err && <div className={styles.err}>{err}</div>}

      {mode === 'choose' && (
        <div className={styles.choices}>
          {!isSong && (
            <>
              <button className={styles.choice} onClick={() => setMode('rename')}>
                <Icon name="pencil" size={20} className={styles.choiceIcon} />
                <span>Umbenennen</span>
              </button>
              <button className={styles.choice} onClick={() => setMode('song')}>
                <Icon name="music" size={20} className={styles.choiceIcon} />
                <span>Lied verknüpfen</span>
              </button>
            </>
          )}
          {isSong && (
            <button
              className={styles.choice}
              disabled={busy}
              onClick={() => run(onUnlinkSong, 'Verknüpfung aufheben fehlgeschlagen.')}
            >
              <Icon name="link" size={20} className={styles.choiceIcon} />
              <span>Verknüpfung aufheben</span>
            </button>
          )}
          <button className={styles.choice} onClick={() => setMode('responsible')}>
            <Icon name="people" size={20} className={styles.choiceIcon} />
            <span>Verantwortlich</span>
          </button>
          <button className={styles.choice} onClick={() => setMode('duration')}>
            <Icon name="clock" size={20} className={styles.choiceIcon} />
            <span>Dauer</span>
          </button>
          <button
            className={styles.choice}
            onClick={() => {
              onToggleTimeHidden();
              onClose();
            }}
          >
            <Icon name={timeHidden ? 'eye' : 'eye-off'} size={20} className={styles.choiceIcon} />
            <span>{timeHidden ? 'Uhrzeit einblenden' : 'Uhrzeit ausblenden'}</span>
          </button>
          <button
            className={`${styles.choice} ${styles.danger}`}
            onClick={() => {
              onClose();
              onRequestDelete();
            }}
          >
            <Icon name="trash" size={20} className={styles.choiceIcon} />
            <span>Löschen</span>
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
          onPick={(arrangementId) =>
            run(() => onLinkSong(arrangementId), 'Verknüpfen fehlgeschlagen.')
          }
        />
      )}

      {mode === 'responsible' && (
        <div className={styles.form}>
          <ResponsibleField
            autoFocus
            value={responsible}
            onChange={setResponsible}
            services={services}
          />
          <button
            className={styles.primary}
            disabled={busy || responsible === item.responsibleText}
            onClick={() =>
              run(() => onSetResponsible(responsible.trim()), 'Speichern fehlgeschlagen.')
            }
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      )}

      {mode === 'duration' && (
        <div className={styles.form}>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={0}
            value={duration}
            autoFocus
            placeholder="Minuten"
            onChange={(e) => setDuration(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && durationValid && durationNum !== item.durationMin) {
                run(() => onSetDuration(durationNum as number), 'Speichern fehlgeschlagen.');
              }
            }}
          />
          <button
            className={styles.primary}
            disabled={busy || !durationValid || durationNum === item.durationMin}
            onClick={() =>
              run(() => onSetDuration(durationNum as number), 'Speichern fehlgeschlagen.')
            }
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
