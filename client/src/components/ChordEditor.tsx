import { useState } from 'react';
import { parseChordPro } from '../utils/chordpro';
import { Section } from './Section';
import { Spinner } from './Spinner';
import styles from './ChordEditor.module.scss';

interface ChordEditorProps {
  songTitle: string;
  initialText: string;
  /** Vorbelegter Versionsname (leer = neue Version). */
  initialName: string;
  /** true = neue Version anlegen (Name erforderlich); false = vorhandene Version bearbeiten. */
  isNew: boolean;
  saving: boolean;
  error: string | null;
  onSave: (text: string, name: string) => void;
  /** Diese Version löschen (nur beim Bearbeiten einer vorhandenen Version). */
  onDelete?: () => void;
  onClose: () => void;
}

/** Vollbild-Editor für eine ChordPro-Version mit Live-Vorschau und Versionsname. */
export function ChordEditor({
  songTitle,
  initialText,
  initialName,
  isNew,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: ChordEditorProps) {
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const sections = parseChordPro(text);
  const canSave = name.trim().length > 0 && text.trim().length > 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <button className={`${styles.barBtn} ${styles.cancel}`} onClick={onClose} disabled={saving}>
          Abbrechen
        </button>
        <span className={styles.title}>{songTitle}</span>
        <button
          className={`${styles.barBtn} ${styles.save}`}
          onClick={() => onSave(text, name.trim())}
          disabled={saving || !canSave}
        >
          {saving ? <Spinner /> : 'Speichern'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.nameRow}>
        <label className={styles.nameLbl} htmlFor="versionName">
          Versionsname
        </label>
        <input
          id="versionName"
          className={styles.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Akustik, Jugend, Weihnachten"
          maxLength={60}
          spellCheck={false}
        />
      </div>

      <div className={styles.hint}>
        {isNew
          ? 'Wird als eigene Version in ChurchTools gespeichert – das Original und andere Versionen bleiben erhalten.'
          : 'Änderungen an dieser Version werden in ChurchTools gespeichert. Das Original bleibt unangetastet.'}{' '}
        Akkorde in eckigen Klammern vor der Silbe, z.B. <code>[G]Halleluja</code>; Abschnitte mit{' '}
        <code>{'{comment: Vers}'}</code>.
      </div>

      <div className={styles.split}>
        <div className={styles.editPane}>
          <div className={styles.paneLbl}>Text</div>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        <div className={styles.previewPane}>
          <div className={styles.paneLbl}>Vorschau</div>
          <div className={styles.preview} style={{ ['--chart-font' as string]: "'Inter', sans-serif" }}>
            {sections.map((sec, i) => (
              <Section key={i} section={sec} semitones={0} fontSize={18} />
            ))}
          </div>
        </div>
      </div>

      {!isNew && onDelete && (
        <div style={{ padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <button className={styles.reset} onClick={onDelete} disabled={saving}>
            Diese Version löschen
          </button>
        </div>
      )}
    </div>
  );
}
