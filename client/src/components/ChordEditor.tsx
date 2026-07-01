import { useRef, useState } from 'react';
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

// Gängige Akkorde für die Palette (englische Notation wie in den ChurchTools-Dateien).
const CHORD_PALETTE = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Dm', 'Em', 'Bm', 'G7', 'D7', 'A7'];
// Abschnitte werden als SongSelect-Kommentar eingefügt – so rendern sie als Überschrift und
// passen zu den bestehenden ChurchTools-Dateien.
const SECTIONS = ['Vers', 'Refrain', 'Pre-Chorus', 'Bridge', 'Intro', 'Outro'];

/** Vollbild-Editor für eine ChordPro-Version: Text + Live-Vorschau (mit Probe-Transponieren),
 *  Eingabe-Toolbar (Akkorde/Abschnitte) und am Handy ein Umschalter Text/Vorschau. */
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
  const [semitones, setSemitones] = useState(0); // nur Vorschau, nicht gespeichert
  const [mobileTab, setMobileTab] = useState<'text' | 'preview'>('text');
  const [recent, setRecent] = useState<string[]>([]); // nur in dieser Sitzung, verschwindet beim Schließen
  const [showHelp, setShowHelp] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const sections = parseChordPro(text);
  const canSave = name.trim().length > 0 && text.trim().length > 0;
  const transposeLabel = semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `${semitones}`;

  /** Fügt Text an der Cursorposition ein (Abschnitte auf eigener Zeile). */
  function insert(snippet: string, block = false) {
    const ta = taRef.current;
    const start = ta ? ta.selectionStart : text.length;
    const end = ta ? ta.selectionEnd : text.length;
    let ins = snippet;
    const before = text.slice(0, start);
    if (block) {
      if (before.length && !before.endsWith('\n')) ins = '\n' + ins;
      if (!ins.endsWith('\n')) ins = ins + '\n';
    }
    setText(before + ins + text.slice(end));
    const caret = start + ins.length;
    requestAnimationFrame(() => {
      const t = taRef.current;
      if (t) {
        t.focus();
        t.setSelectionRange(caret, caret);
      }
    });
  }

  function insertChord(root: string) {
    insert(`[${root}]`);
    setRecent((prev) => [root, ...prev.filter((c) => c !== root)].slice(0, 10));
  }

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

      {/* Umschalter nur am Handy – am großen Bildschirm sind beide Bereiche nebeneinander sichtbar. */}
      <div className={styles.mobileTabs}>
        <button
          className={`${styles.mtab}${mobileTab === 'text' ? ' ' + styles.mtabOn : ''}`}
          onClick={() => setMobileTab('text')}
        >
          Text
        </button>
        <button
          className={`${styles.mtab}${mobileTab === 'preview' ? ' ' + styles.mtabOn : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          Vorschau
        </button>
      </div>

      <div className={styles.split}>
        <div className={`${styles.editPane}${mobileTab !== 'text' ? ' ' + styles.hideMobile : ''}`}>
          {/* Eingabe-Toolbar (Akkorde / zuletzt genutzt / Abschnitte / Hilfe) */}
          <div className={styles.toolbar}>
            <div className={styles.tbRow}>
              {CHORD_PALETTE.map((c) => (
                <button key={c} className={styles.chip} onClick={() => insertChord(c)} type="button">
                  {c}
                </button>
              ))}
            </div>
            {recent.length > 0 && (
              <div className={styles.tbRow}>
                <span className={styles.tbLbl}>Zuletzt</span>
                {recent.map((c) => (
                  <button
                    key={c}
                    className={`${styles.chip} ${styles.chipRecent}`}
                    onClick={() => insertChord(c)}
                    type="button"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.tbRow}>
              <span className={styles.tbLbl}>Abschnitt</span>
              {SECTIONS.map((s) => (
                <button
                  key={s}
                  className={`${styles.chip} ${styles.chipSection}`}
                  onClick={() => insert(`{comment: ${s}}`, true)}
                  type="button"
                >
                  {s}
                </button>
              ))}
              <button
                className={`${styles.chip} ${styles.chipHelp}`}
                onClick={() => setShowHelp((v) => !v)}
                type="button"
                aria-expanded={showHelp}
              >
                ? Hilfe
              </button>
            </div>
            {showHelp && (
              <div className={styles.help}>
                <div>
                  <code>[G]Halleluja</code> – Akkord direkt vor die Silbe setzen.
                </div>
                <div>
                  <code>{'{comment: Vers}'}</code> – Überschrift für einen Abschnitt (Vers, Refrain …).
                </div>
                <div>Das Transponieren in der Vorschau ändert nur die Anzeige, nicht den gespeicherten Text.</div>
                <div>
                  Die Version wird als eigene Datei in ChurchTools gespeichert – Original und andere Versionen
                  bleiben erhalten.
                </div>
              </div>
            )}
          </div>
          <textarea
            ref={taRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <div className={`${styles.previewPane}${mobileTab !== 'preview' ? ' ' + styles.hideMobile : ''}`}>
          <div className={styles.previewHead}>
            <span className={styles.paneLbl}>Vorschau</span>
            <div className={styles.transpose}>
              <button
                className={styles.tBtn}
                onClick={() => setSemitones((s) => Math.max(-11, s - 1))}
                aria-label="Tiefer transponieren"
                type="button"
              >
                −
              </button>
              <button
                className={styles.tVal}
                onClick={() => setSemitones(0)}
                title="Transponierung zurücksetzen"
                type="button"
              >
                {transposeLabel}
              </button>
              <button
                className={styles.tBtn}
                onClick={() => setSemitones((s) => Math.min(11, s + 1))}
                aria-label="Höher transponieren"
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.preview}>
            {sections.length === 0 ? (
              <div className={styles.empty}>Noch kein Inhalt – links Text eingeben.</div>
            ) : (
              sections.map((sec, i) => <Section key={i} section={sec} semitones={semitones} fontSize={18} />)
            )}
          </div>
        </div>
      </div>

      {!isNew && onDelete && (
        <div className={styles.deleteRow}>
          <button className={styles.reset} onClick={onDelete} disabled={saving}>
            Diese Version löschen
          </button>
        </div>
      )}
    </div>
  );
}
