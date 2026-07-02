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
// Format-Bausteine (echte ChordPro-Direktiven, chordpro.org) mit deutscher Erklärung.
// `value` = mit Doppelpunkt-Wert. Hinweis: nur comment + title/artist/key/tempo/time wirken in der
// App-Vorschau; die übrigen sind gültiges ChordPro und werden gespeichert (SongSelect/andere Tools).
const FORMATS: { tag: string; label: string; value: boolean }[] = [
  { tag: 'comment', label: 'Abschnitt / Überschrift', value: true },
  { tag: 'title', label: 'Titel des Lieds', value: true },
  { tag: 'subtitle', label: 'Untertitel', value: true },
  { tag: 'artist', label: 'Interpret / Künstler', value: true },
  { tag: 'key', label: 'Tonart', value: true },
  { tag: 'capo', label: 'Kapo (Bund)', value: true },
  { tag: 'tempo', label: 'Tempo (BPM)', value: true },
  { tag: 'time', label: 'Taktart', value: true },
  { tag: 'ccli', label: 'CCLI-Nummer', value: true },
  { tag: 'copyright', label: 'Copyright', value: true },
  { tag: 'column_break', label: 'Neue Spalte beginnen', value: false },
  { tag: 'new_page', label: 'Neuer Seitenumbruch', value: false },
];

type View = 'both' | 'editor' | 'preview';

/** Vollbild-Editor für eine ChordPro-Version: CodeMirror mit Syntax-Farben, Eingabe-Dropdowns
 *  (Akkorde/Format), zuletzt genutzte Akkorde, Rückgängig/Wiederholen und eine „wie gedruckt"-
 *  PDF-Vorschau mit Transponieren. Ansicht umschaltbar (Editor / Beide / Vorschau). */
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
  const [recent, setRecent] = useState<string[]>([]); // nur in dieser Sitzung
  const [openMenu, setOpenMenu] = useState<'chord' | 'format' | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [view, setView] = useState<View>('both');
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );
  const editorRef = useRef<ChordProHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const canSave = name.trim().length > 0 && text.trim().length > 0;
  const transposeLabel = semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `${semitones}`;
  // „Beide" gibt es nur auf breiten Fenstern; sonst als „Editor" behandeln.
  const effView: View = !wide && view === 'both' ? 'editor' : view;
  const showEditor = effView !== 'preview';
  const showPreview = effView !== 'editor';

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // iOS-Tastatur: Der Overlay bleibt VOLLBILD (fixed, inset 0) – so schimmert hinter der
  // halbtransparenten Tastatur nichts von der dahinterliegenden Ansicht durch. Statt den Overlay
  // zu verschieben (das „sprang" sichtbar), bekommt er unten einen Innenabstand in Höhe der
  // Tastatur (--kb aus dem visualViewport) → Kopf-/Werkzeugleiste bleiben stehen, nur der intern
  // scrollende Editor-Bereich wird kürzer. Das automatische Hochschieben der SEITE durch iOS wird
  // mit scrollTo(0,0) neutralisiert.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = overlayRef.current;
    if (!vv || !el) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty('--kb', `${kb}px`);
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      el.style.removeProperty('--kb');
    };
  }, []);

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
  function pickFormat(f: { tag: string; value: boolean }) {
    if (f.value) editorRef.current?.insert(`{${f.tag}: }`, { block: true, caretBack: 1 });
    else editorRef.current?.insert(`{${f.tag}}`, { block: true });
    setOpenMenu(null);
  }

  return (
    <div ref={overlayRef} className={styles.overlay}>
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
            onClick={() => setOpenMenu((m) => (m === 'format' ? null : 'format'))}
            aria-expanded={openMenu === 'format'}
          >
            Format ▾
          </button>
          {openMenu === 'format' && (
            <div className={`${styles.ddPanel} ${styles.ddPanelWide}`}>
              {FORMATS.map((f) => (
                <button key={f.tag} className={styles.ddFormat} onClick={() => pickFormat(f)}>
                  <span className={styles.ddFormatLabel}>{f.label}</span>
                  <code className={styles.ddFormatTag}>{f.tag}</code>
                </button>
              ))}
            </div>
          )}
        </div>

        {recent.length > 0 && (
          <div className={styles.tbRecent}>
            <span className={styles.tbRecentLbl}>Zuletzt</span>
            {recent.map((c) => (
              <button key={c} className={styles.recentChip} onClick={() => pickChord(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

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
      </div>

      {/* Ansicht umschalten */}
      <div className={styles.viewSeg}>
        <button
          className={`${styles.vseg}${effView === 'editor' ? ' ' + styles.vsegOn : ''}`}
          onClick={() => setView('editor')}
        >
          Editor
        </button>
        {wide && (
          <button
            className={`${styles.vseg}${effView === 'both' ? ' ' + styles.vsegOn : ''}`}
            onClick={() => setView('both')}
          >
            Beide
          </button>
        )}
        <button
          className={`${styles.vseg}${effView === 'preview' ? ' ' + styles.vsegOn : ''}`}
          onClick={() => setView('preview')}
        >
          Vorschau
        </button>
      </div>

      <div className={styles.split}>
        {/* Editor bleibt immer gemountet (Verlauf/Cursor erhalten), nur ausgeblendet. */}
        <div className={`${styles.editPane}${showEditor ? '' : ' ' + styles.paneHidden}`}>
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

        {showPreview && (
          <div className={styles.previewPane}>
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
        )}
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
