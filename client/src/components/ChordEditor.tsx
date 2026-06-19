import { useState } from 'react';
import { parseChordPro } from '../utils/chordpro';
import { Section } from './Section';
import { Spinner } from './Spinner';
import styles from './ChordEditor.module.scss';

interface ChordEditorProps {
  songTitle: string;
  initialText: string;
  /** true, wenn bereits eine bearbeitete Version existiert (Zurücksetzen anbieten). */
  hasEdited: boolean;
  saving: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onReset: () => void;
  onClose: () => void;
}

/** Vollbild-Editor für den ChordPro-Text mit Live-Vorschau. */
export function ChordEditor({
  songTitle,
  initialText,
  hasEdited,
  saving,
  error,
  onSave,
  onReset,
  onClose,
}: ChordEditorProps) {
  const [text, setText] = useState(initialText);
  const sections = parseChordPro(text);

  return (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <button className={`${styles.barBtn} ${styles.cancel}`} onClick={onClose} disabled={saving}>
          Abbrechen
        </button>
        <span className={styles.title}>{songTitle}</span>
        <button className={`${styles.barBtn} ${styles.save}`} onClick={() => onSave(text)} disabled={saving}>
          {saving ? <Spinner /> : 'Speichern'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.hint}>
        Bearbeite den Text. Akkorde stehen in eckigen Klammern direkt vor der Silbe, z.B.
        <code> [G]Halleluja</code>. Abschnitte mit <code>{'{comment: Vers}'}</code>. Wird als bearbeitete
        Version in ChurchTools gespeichert – das Original bleibt erhalten.
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

      {hasEdited && (
        <div style={{ padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <button className={styles.reset} onClick={onReset} disabled={saving}>
            Auf Original zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
