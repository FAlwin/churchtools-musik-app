import { useMemo, useState } from 'react';
import type { AgendaItem, AgendaServiceOption } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';
import { pendingAgendaFields, isDurationValid, type LinkState } from '../utils/agendaItemChanges';
import { SongPicker } from './SongPicker';
import { ResponsibleField } from './ResponsibleField';
import { Icon } from './icons';
import { useOverlayKeyboardInset } from '../hooks/useOverlayKeyboardInset';
import styles from './ItemActionSheet.module.scss';

interface ItemActionSheetProps {
  item: AgendaItem;
  onClose: () => void;
  /** Schreibt die geänderten Felder gesammelt (EIN Request). Wirft bei Fehler. */
  onUpdate: (fields: AgendaItemUpdate) => Promise<void>;
  /** Ist die Uhrzeit dieses Punkts in ChurchTools ausgeblendet? */
  timeHidden: boolean;
  /** Blendet die Uhrzeit dieses Punkts in ChurchTools aus (true) oder ein (false). Wirft bei Fehler. */
  onSetHidden: (hidden: boolean) => Promise<void>;
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
  onUpdate,
  timeHidden,
  onSetHidden,
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
  // Verknüpfung wird vorgemerkt und erst beim Speichern nach ChurchTools geschrieben
  // ('keep' = unverändert, 'unlink' = Lied entfernen, 'link' = neues Arrangement verknüpfen).
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'keep' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Dialog über der iOS-Tastatur freihalten; verhindert auch die verrutschte Kopfleiste (#207).
  const overlayRef = useOverlayKeyboardInset();

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

  // „Was würde gespeichert?" ist Geschäftslogik und liegt als reine Funktion daneben (#215) –
  // damit läuft sie einmal je Änderung statt bei jedem Render und ist geprüft.
  const durationValid = isDurationValid(duration);
  const pending = useMemo(
    () => pendingAgendaFields(item, { title, duration, responsible, note, link: linkState }),
    [item, title, duration, responsible, note, linkState],
  );

  const dirty = Object.keys(pending).length > 0 || hidden !== timeHidden;

  async function saveAll() {
    setBusy(true);
    setErr(null);
    try {
      // Alle Feld-Änderungen in EINEM Request (kein Teilzustand bei Fehlern); nur der
      // Uhrzeit-Schalter ist in ChurchTools ein eigener Endpunkt.
      if (Object.keys(pending).length > 0) await onUpdate(pending);
      if (hidden !== timeHidden) await onSetHidden(hidden);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  // Klick auf den Hintergrund: nur schließen, wenn nichts vorgemerkt ist – sonst würde ein
  // versehentlicher Tipp daneben alle ungespeicherten Änderungen verwerfen. Mit Änderungen
  // führt der Weg raus bewusst über „Abbrechen" (verwerfen) oder „Speichern".
  function onOverlayClick() {
    if (!dirty) onClose();
  }

  // Unterdialog: Lied suchen + verknüpfen.
  if (songMode) {
    return (
      <div ref={overlayRef} className={styles.overlay} onClick={onOverlayClick}>
        <div className={styles.card} onClick={(e) => e.stopPropagation()}>
          <div className={styles.title}>Lied verknüpfen</div>
          {err && <div className={styles.err}>{err}</div>}
          <SongPicker
            autoFocus
            aktionLabel="Mit diesem Eintrag verknüpfen"
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
    <div ref={overlayRef} className={styles.overlay} onClick={onOverlayClick}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>Eintrag bearbeiten</div>
        {err && <div className={styles.err}>{err}</div>}

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.label}>Titel</span>
            {/* Auch bei Liedern änderbar (#200): ChurchTools führt Titel und Lied getrennt und
                zeigt beides. Der Liedname steht darunter im Feld „Lied". */}
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={willBeSong ? 'z. B. Lied' : 'Titel'}
            />
          </div>

          {/* Überschriften haben nur einen Titel – keine weiteren Felder. */}
          {!item.isHeader && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Lied</span>
                {effSong ? (
                  <>
                    {/* Liedname sichtbar halten – er kommt aus ChurchTools und ist hier nicht änderbar. */}
                    <div className={styles.readonly}>{effSong.title}</div>
                    <button className={styles.linkRow} disabled={busy} onClick={clearLink}>
                      <Icon name="link" size={17} className={styles.linkIcon} />
                      Verknüpfung aufheben
                    </button>
                  </>
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
