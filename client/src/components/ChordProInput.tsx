import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, ViewPlugin, keymap } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import {
  history,
  historyKeymap,
  defaultKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
} from '@codemirror/commands';
import styles from './ChordProInput.module.scss';

/** Imperative Schnittstelle für Toolbar-Aktionen (Einfügen / Rückgängig / Wiederholen). */
export interface ChordProHandle {
  /** Fügt Text an der Cursorposition ein. `block` = auf eigener Zeile; `caretBack` = Cursor n Zeichen vor das Ende. */
  insert: (text: string, opts?: { block?: boolean; caretBack?: number }) => void;
  /** Hängt `suffix` an den zuletzt gesetzten Akkord an (steht der Cursor direkt hinter `[…]`,
   *  wird der Zusatz VOR das `]` eingefügt, z. B. `[C]` + "m7" → `[Cm7]`). Sonst ohne Wirkung. */
  appendChord: (suffix: string) => void;
  undo: () => void;
  redo: () => void;
}

const chordMark = Decoration.mark({ class: 'cm-cp-chord' });
const dirMark = Decoration.mark({ class: 'cm-cp-dir' });
const dirValMark = Decoration.mark({ class: 'cm-cp-dir-val' });

/** Färbt Akkorde [X] und Direktiven {…} ein (regex-basiert über die sichtbaren Bereiche).
 *  Direktiven mit Wert (z. B. `{title: Treu}`) werden aufgeteilt: das Label `{title:` bleibt
 *  dezent teal, der eigentliche Wert (Titel/Artist/…) wird kräftig und gut lesbar dargestellt. */
function buildDeco(view: EditorView): DecorationSet {
  const marks: { from: number; to: number; deco: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    const chordRe = /\[[^\]\n]*\]/g;
    while ((m = chordRe.exec(text)))
      marks.push({ from: from + m.index, to: from + m.index + m[0].length, deco: chordMark });
    const dirRe = /\{[^}\n]*\}/g;
    while ((m = dirRe.exec(text))) {
      const start = from + m.index;
      const end = start + m[0].length;
      const colon = m[0].indexOf(':');
      // Direktive mit Wert → Label + Wert getrennt einfärben; sonst ganze Direktive teal.
      if (colon !== -1 && start + colon + 1 < end - 1) {
        marks.push({ from: start, to: start + colon + 1, deco: dirMark }); // `{title:`
        marks.push({ from: start + colon + 1, to: end - 1, deco: dirValMark }); // ` Treu`
        marks.push({ from: end - 1, to: end, deco: dirMark }); // `}`
      } else {
        marks.push({ from: start, to: end, deco: dirMark });
      }
    }
  }
  marks.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const mk of marks) builder.add(mk.from, mk.to, mk.deco);
  return builder.finish();
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDeco(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDeco(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

// Moderner, „un-typewriter"-Look: proportionale App-Schrift (ChordPro-Akkorde stehen inline in
// [..], daher ist kein Monospace zum Ausrichten nötig), großzügige Zeilenhöhe, und Akkorde als
// dezente farbige Chips – dadurch wirkt der Text ruhig UND die Struktur springt sofort ins Auge.
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--surface2)', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--ui)',
    // Ziffern/Buchstaben in Akkorden gleich breit halten → Chips wirken ruhig.
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-content': { padding: '18px 18px 32px', fontSize: '16px', lineHeight: '1.95', caretColor: 'var(--blue)' },
  // Akkorde [C] als kompakter Chip mit zartem Hintergrund.
  '.cm-cp-chord': {
    color: 'var(--blue-ink)',
    fontWeight: '800',
    backgroundColor: 'var(--blue-soft)',
    borderRadius: '5px',
    padding: '1px 4px',
    margin: '0 1px',
  },
  // Direktiven-Label {title: dezent, Wert kräftig lesbar.
  '.cm-cp-dir': { color: 'var(--cp-dir)', fontWeight: '700' },
  '.cm-cp-dir-val': { color: 'var(--text)', fontWeight: '800' },
  '.cm-cursor': { borderLeftColor: 'var(--blue)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--blue-soft)' },
});

interface ChordProInputProps {
  initialText: string;
  onChange: (text: string) => void;
  onHistory?: (canUndo: boolean, canRedo: boolean) => void;
}

/** ChordPro-Eingabe auf Basis von CodeMirror: Syntax-Farben, echtes Rückgängig/Wiederholen,
 *  saubere Einfügung an der Cursorposition. */
export const ChordProInput = forwardRef<ChordProHandle, ChordProInputProps>(function ChordProInput(
  { initialText, onChange, onHistory },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          highlighter,
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
            if (u.docChanged || u.selectionSet)
              onHistory?.(undoDepth(u.state) > 0, redoDepth(u.state) > 0);
          }),
        ],
      }),
      parent: hostRef.current as HTMLElement,
    });
    viewRef.current = view;
    onHistory?.(false, false);
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    insert(text, opts) {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      let ins = text;
      if (opts?.block) {
        const before = sel.from > 0 ? view.state.doc.sliceString(sel.from - 1, sel.from) : '\n';
        if (before !== '\n') ins = '\n' + ins;
        if (!ins.endsWith('\n')) ins = ins + '\n';
      }
      const caret = sel.from + ins.length - (opts?.caretBack ?? 0);
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: ins }, selection: { anchor: caret } });
      view.focus();
    },
    appendChord(suffix) {
      const view = viewRef.current;
      if (!view || !suffix) return;
      const sel = view.state.selection.main;
      if (sel.from !== sel.to || sel.from === 0) return; // Auswahl/Anfang → nichts anhängen
      const doc = view.state.doc;
      const line = doc.lineAt(sel.from);
      const before = doc.sliceString(line.from, sel.from);
      if (!before.endsWith(']')) return; // Cursor steht nicht direkt hinter einem Akkord
      const open = before.lastIndexOf('[');
      if (open === -1) return;
      const inner = before.slice(open + 1, -1); // Inhalt zwischen [ und ]
      if (inner.includes('[') || inner.includes(']')) return; // kein sauberes [..]
      const insertPos = sel.from - 1; // direkt vor das ]
      view.dispatch({
        changes: { from: insertPos, insert: suffix },
        selection: { anchor: sel.from + suffix.length },
      });
      view.focus();
    },
    undo() {
      const v = viewRef.current;
      if (v) {
        undo(v);
        v.focus();
      }
    },
    redo() {
      const v = viewRef.current;
      if (v) {
        redo(v);
        v.focus();
      }
    },
  }));

  return <div ref={hostRef} className={styles.host} />;
});
