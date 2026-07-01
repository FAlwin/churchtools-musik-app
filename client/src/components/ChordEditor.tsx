import { useEffect, useRef, useState } from 'react';
import { ChordProInput, type ChordProHandle } from './ChordProInput';
import { PdfPreview } from './PdfPreview';
import { Icon } from './icons';
import { Spinner } from './Spinner';
import styles from './ChordEditor.module.scss';

interface ChordEditorProps {
  songTitle: string;
  initialText: string;
  initialName: string;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  onSave: (text: string, name: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Grundtöne wie im ChurchTools-SongSelect-Editor (mit #/b).
const CHORD_ROOTS = ['Ab', 'A', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G'];
// Direktiven (Tags) – Wert-Tags bekommen {tag: }, die anderen {tag}.
const TAGS: { tag: string; value: boolean }[] = [
  { tag: 'title', value: true },
  { tag: 'author', value: true },
  { tag: 'key', value: true },
  { tag: 'capo', value: true },
  { tag: 'tempo', value: true },
  { tag: 'time', value: true },
  { tag: 'comment', value: true },
  { tag: 'direction', value: true },
  { tag: 'column_break', value: false },
  { tag: 'line_wrap', value: false },
];

/** Vollbild-Editor für eine ChordPro-Version: CodeMirror mit Syntax-Farben, Eingabe-Dropdowns
 *  (Akkorde/Tags), Rückgängig/Wiederholen und einer „wie gedruckt"-PDF-Vorschau mit Transponieren. */
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
  const [semitones, setSemitones] = useState(0);
  const [mobileTab, setMobileTab] = useState<'text' | 'preview'>('text');
  const [showPreview, setShowPreview] = useState(true); // Desktop: Vorschau ein/aus
  const [recent, setRecent] = useState<string[]>([]); // nur in dieser Sitzung
  const [openMenu, setOpenMenu] = useState<'chord' | 'tag' | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const editorRef = useRef<ChordProHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const canSave = name.trim().length > 0 && text.trim().length > 0;
  const transposeLabel = semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `${semitones}`;

  // Menüs bei Klick außerhalb schließen
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openMenu]);

  function pickChord(chord: string) {
    editorRef.current?.insert(`[${chord}]`);
    setRecent((prev) => [chord, ...prev.filter((c) => c !== chord)].slice(0, 10));
    setOpenMenu(null);
  }
  function pickTag(t: { tag: string; value: boolean }) {
    if (t.value) editorRef.current?.insert(`{${t.tag}: }`, { block: true, caretBack: 1 });
    else editorRef.current?.insert(`{${t.tag}}`, { block: true });
    setOpenMenu(null);
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

      {/* Eingabe-Toolbar */}
      <div className={styles.toolbar} ref={toolbarRef}>
        <div className={styles.dd}>
          <button
            className={styles.ddBtn}
            onClick={() => setOpenMenu((m) => (m === 'chord' ? null : 'chord'))}
            aria-expanded={openMenu === 'chord'}
          >
            Akkord ▾
          </button>
          {openMenu === 'chord' && (
            <div className={styles.ddPanel}>
              {recent.length > 0 && (
                <div className={styles.ddRecent}>
                  <span className={styles.ddSectionLbl}>Zuletzt</span>
                  <div className={styles.ddChips}>
                    {recent.map((c) => (
                      <button key={c} className={styles.ddChip} onClick={() => pickChord(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {CHORD_ROOTS.map((root) => (
                <div key={root} className={styles.ddRow}>
                  <span className={styles.ddRoot}>{root}</span>
                  <div className={styles.ddQual}>
                    <button onClick={() => pickChord(root)}>Dur</button>
                    <button onClick={() => pickChord(`${root}m`)}>m</button>
                    <button onClick={() => pickChord(`${root}7`)}>7</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.dd}>
          <button
            className={styles.ddBtn}
            onClick={() => setOpenMenu((m) => (m === 'tag' ? null : 'tag'))}
            aria-expanded={openMenu === 'tag'}
          >
            Tag ▾
          </button>
          {openMenu === 'tag' && (
            <div className={styles.ddPanel}>
              {TAGS.map((t) => (
                <button key={t.tag} className={styles.ddItem} onClick={() => pickTag(t)}>
                  {t.tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.tbSpacer} />

        <button
          className={styles.iconBtn}
          onClick={() => editorRef.current?.undo()}
          disabled={!canUndo}
          title="Rückgängig"
          aria-label="Rückgängig"
        >
          <Icon name="undo" size={18} stroke={2} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => editorRef.current?.redo()}
          disabled={!canRedo}
          title="Wiederholen"
          aria-label="Wiederholen"
        >
          <Icon name="redo" size={18} stroke={2} />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.previewToggle}${showPreview ? ' ' + styles.previewToggleOn : ''}`}
          onClick={() => setShowPreview((v) => !v)}
          title={showPreview ? 'Vorschau ausblenden' : 'Vorschau einblenden'}
          aria-label="Vorschau ein-/ausblenden"
        >
          <Icon name="columns" size={18} stroke={2} />
        </button>
      </div>

      {/* Umschalter Text/Vorschau – nur am Handy */}
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
          <ChordProInput
            ref={editorRef}
            initialText={initialText}
            onChange={setText}
            onHistory={(u, r) => {
              setCanUndo(u);
              setCanRedo(r);
            }}
          />
        </div>

        <div
          className={
            `${styles.previewPane}` +
            (mobileTab !== 'preview' ? ' ' + styles.hideMobile : '') +
            (!showPreview ? ' ' + styles.hideDesktop : '')
          }
        >
          <div className={styles.previewHead}>
            <span className={styles.paneLbl}>Vorschau</span>
            <div className={styles.transpose}>
              <button
                className={styles.tBtn}
                onClick={() => setSemitones((s) => Math.max(-11, s - 1))}
                aria-label="Tiefer transponieren"
              >
                −
              </button>
              <button className={styles.tVal} onClick={() => setSemitones(0)} title="Zurücksetzen">
                {transposeLabel}
              </button>
              <button
                className={styles.tBtn}
                onClick={() => setSemitones((s) => Math.min(11, s + 1))}
                aria-label="Höher transponieren"
              >
                +
              </button>
            </div>
          </div>
          <PdfPreview title={songTitle} text={text} semitones={semitones} />
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
