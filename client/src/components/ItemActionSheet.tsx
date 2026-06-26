import { useState } from 'react';
import type { AgendaItem, AgendaServiceOption } from '@shared/types/index';
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
  /** Ist die Uhrzeit dieses Punkts in ChurchTools ausgeblendet? */
  timeHidden: boolean;
  /** Blendet die Uhrzeit dieses Punkts in ChurchTools aus (true) oder ein (false). Wirft bei Fehler. */
  onToggleHidden: (hidden: boolean) => Promise<void>;
  /** Setzt die Bemerkung/Notiz des Punkts. Wirft bei Fehler. */
  onSetNote: (note: string) => Promise<void>;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Löschen anstoßen (Bestätigung erfolgt im Eltern-Screen). */
  onRequestDelete: () => void;
}

/**
 * „Eintrag bearbeiten"-Dialog: ein zentriertes Modal mit allen Einstellungen auf einen Blick
 * (Titel, Lied, Dauer, Zuständig, Uhrzeit ausblenden, Löschen) – angelehnt an den
 * „Position bearbeiten"-Dialog in ChurchTools. „Speichern" schreibt die geänderten Felder
 * gesammelt nach ChurchTools.
 */
export function ItemActionSheet({
  item,
  onClose,
  onRename,
  onLinkSong,
  onUnlinkSong,
  onSetResponsible,
  onSetDuration,
  timeHidden,
  onToggleHidden,
  onSetNote,
  services,
  onRequestDelete,
}: ItemActionSheetProps) {
  const isSong = !!item.song;
  const [songMode, setSongMode] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [responsible, setResponsible] = useState(item.responsibleText);
  const [note, setNote] = useState(item.note);
  const [duration, setDuration] = useState(
    item.durationMin != null ? String(item.durationMin) : '',
  );
  // Uhrzeit-ausgeblendet: optimistisch lokal umschalten, bei Fehler zurückrollen.
  const [hidden, setHidden] = useState(timeHidden);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    setErr(null);
    void onToggleHidden(next).catch((e: unknown) => {
      setHidden(!next);
      setErr(e instanceof Error ? e.message : 'Uhrzeit ändern fehlgeschlagen.');
    });
  }

  const durationNum = duration.trim() === '' ? null : Number(duration);
  const durationValid = durationNum === null || (Number.isInteger(durationNum) && durationNum >= 0);

  async function saveAll() {
    setBusy(true);
    setErr(null);
    try {
      // Nur tatsächlich geänderte Felder schreiben.
      if (!isSong && title.trim() && title.trim() !== item.title) {
        await onRename(title.trim());
      }
      if (durationNum !== null && durationNum !== item.durationMin) {
        await onSetDuration(durationNum);
      }
      if (responsible !== item.responsibleText) {
        await onSetResponsible(responsible.trim());
      }
      if (note !== item.note) {
        await onSetNote(note.trim());
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  // Unterdialog: Lied suchen + verknüpfen.
  if (songMode) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.card} onClick={(e) => e.stopPropagation()}>
          <div className={styles.title}>Lied verknüpfen</div>
          {err && <div className={styles.err}>{err}</div>}
          <SongSearch
            autoFocus
            busy={busy}
            onPick={(arrangementId) => {
              setBusy(true);
              setErr(null);
              onLinkSong(arrangementId)
                .then(onClose)
                .catch((e: unknown) => {
                  setErr(e instanceof Error ? e.message : 'Verknüpfen fehlgeschlagen.');
                  setBusy(false);
                });
            }}
          />
          <button className={styles.linkRow} onClick={() => setSongMode(false)} disabled={busy}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>Eintrag bearbeiten</div>
        {err && <div className={styles.err}>{err}</div>}

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.label}>Titel</span>
            {isSong ? (
              <div className={styles.readonly}>{item.song?.title}</div>
            ) : (
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel"
              />
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Lied</span>
            {isSong ? (
              <button
                className={styles.linkRow}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setErr(null);
                  onUnlinkSong()
                    .then(onClose)
                    .catch((e: unknown) => {
                      setErr(e instanceof Error ? e.message : 'Aufheben fehlgeschlagen.');
                      setBusy(false);
                    });
                }}
              >
                <Icon name="link" size={17} className={styles.linkIcon} />
                Verknüpfung aufheben
              </button>
            ) : (
              <button className={styles.linkRow} onClick={() => setSongMode(true)}>
                <Icon name="music" size={17} className={styles.linkIcon} />
                Lied verknüpfen
              </button>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Dauer (Minuten)</span>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="z. B. 5"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Zuständig</span>
            <ResponsibleField value={responsible} onChange={setResponsible} services={services} />
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

          <button className={styles.toggleRow} onClick={toggleHidden} aria-pressed={hidden}>
            <span className={styles.label}>Uhrzeit ausblenden</span>
            <span className={`${styles.tog}${hidden ? ' ' + styles.togOn : ''}`}>
              <span className={styles.togThumb} />
            </span>
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button className={styles.saveBtn} onClick={saveAll} disabled={busy || !durationValid}>
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>

        <button
          className={styles.deleteBtn}
          onClick={() => {
            onClose();
            onRequestDelete();
          }}
        >
          <Icon name="trash" size={16} />
          Eintrag löschen
        </button>
      </div>
    </div>
  );
}
