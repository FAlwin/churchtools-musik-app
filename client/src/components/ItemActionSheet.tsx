import { useState } from 'react';
import type { AgendaItem, AgendaServiceOption } from '@shared/types/index';
import { SongPicker } from './SongPicker';
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
 * „Position bearbeiten"-Dialog in ChurchTools. NICHTS wird sofort geschrieben: auch Lied
 * verknüpfen/aufheben und der Uhrzeit-Schalter werden nur vorgemerkt. Erst „Speichern" schreibt
 * alle Änderungen gesammelt nach ChurchTools; „Abbrechen" verwirft sie. (Löschen ist bewusst
 * separat und hat eine eigene Rückfrage.)
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
  // Uhrzeit-ausgeblendet: lokal – wird wie alles andere erst beim Speichern übernommen.
  const [hidden, setHidden] = useState(timeHidden);
  // Verknüpfung wird vorgemerkt und erst beim Speichern nach ChurchTools geschrieben:
  // 'keep' = unverändert, 'unlink' = Lied entfernen, 'link' = neues Arrangement verknüpfen.
  type LinkState =
    | { kind: 'keep' }
    | { kind: 'unlink' }
    | { kind: 'link'; arrangementId: number; name: string };
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'keep' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Das Lied, das der Punkt nach dem Speichern hätte (steuert Titel-/Lied-Anzeige).
  const effSong =
    linkState.kind === 'link'
      ? { title: linkState.name }
      : linkState.kind === 'keep'
        ? item.song
        : null;
  const willBeSong = !!effSong;

  function toggleHidden() {
    setHidden((h) => !h);
  }

  /** Merkt das Entfernen der Verknüpfung vor – bzw. verwirft eine nur vorgemerkte Verknüpfung. */
  function clearLink() {
    setLinkState(isSong ? { kind: 'unlink' } : { kind: 'keep' });
  }

  const durationNum = duration.trim() === '' ? null : Number(duration);
  const durationValid = durationNum === null || (Number.isInteger(durationNum) && durationNum >= 0);

  const dirty =
    linkState.kind !== 'keep' ||
    hidden !== timeHidden ||
    (durationNum !== null && durationNum !== item.durationMin) ||
    responsible !== item.responsibleText ||
    note !== item.note ||
    (!willBeSong && title.trim() !== item.title);

  async function saveAll() {
    setBusy(true);
    setErr(null);
    try {
      // 1) Struktur zuerst: Verknüpfung anlegen/aufheben.
      if (linkState.kind === 'link') {
        await onLinkSong(linkState.arrangementId);
      } else if (linkState.kind === 'unlink') {
        await onUnlinkSong();
      }
      // 2) Titel – nur wenn der Punkt am Ende KEIN Lied ist (Lied-Titel kommt aus ChurchTools).
      if (!willBeSong) {
        const t = title.trim();
        const changed = linkState.kind === 'unlink' ? !!t : !!t && t !== item.title;
        if (changed) await onRename(t);
      }
      // 3) Weitere Felder – nur bei tatsächlicher Änderung.
      if (durationNum !== null && durationNum !== item.durationMin) {
        await onSetDuration(durationNum);
      }
      if (responsible !== item.responsibleText) {
        await onSetResponsible(responsible.trim());
      }
      if (note !== item.note) {
        await onSetNote(note.trim());
      }
      if (hidden !== timeHidden) {
        await onToggleHidden(hidden);
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
          <SongPicker
            autoFocus
            onPick={(arrangementId, songName) => {
              setLinkState({ kind: 'link', arrangementId, name: songName });
              setErr(null);
              setSongMode(false);
            }}
          />
          <button className={styles.backBtn} onClick={() => setSongMode(false)} disabled={busy}>
            <Icon name="chev-left" size={18} stroke={2.2} />
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
            {effSong ? (
              <div className={styles.readonly}>{effSong.title}</div>
            ) : (
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel"
              />
            )}
          </div>

          {/* Überschriften haben nur einen Titel – keine weiteren Felder. */}
          {!item.isHeader && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Lied</span>
                {effSong ? (
                  <button className={styles.linkRow} disabled={busy} onClick={clearLink}>
                    <Icon name="link" size={17} className={styles.linkIcon} />
                    Verknüpfung aufheben
                  </button>
                ) : (
                  <button
                    className={styles.linkRow}
                    disabled={busy}
                    onClick={() => setSongMode(true)}
                  >
                    <Icon name="music" size={17} className={styles.linkIcon} />
                    Lied verknüpfen
                  </button>
                )}
                {linkState.kind !== 'keep' && (
                  <span className={styles.pendingHint}>
                    {linkState.kind === 'unlink'
                      ? 'Wird beim Speichern entfernt.'
                      : 'Wird beim Speichern verknüpft.'}
                  </span>
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

              <button className={styles.toggleRow} onClick={toggleHidden} aria-pressed={hidden}>
                <span className={styles.label}>Uhrzeit ausblenden</span>
                <span className={`${styles.tog}${hidden ? ' ' + styles.togOn : ''}`}>
                  <span className={styles.togThumb} />
                </span>
              </button>
            </>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            className={styles.saveBtn}
            onClick={saveAll}
            disabled={busy || !durationValid || !dirty}
          >
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
