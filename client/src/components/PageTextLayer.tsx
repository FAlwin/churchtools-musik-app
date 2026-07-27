import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import type { DrawTool } from '../types/index';
import type { usePageDraw, PageTextObj, TextStyle } from '../hooks/usePageDraw';
import { textObjStyle } from '../utils/textObjStyle';
import styles from './PageDeck.module.scss';

/** Anmerkungs-Zustand einer Seite, wie ihn `usePageDraw` liefert. */
type PageDraw = ReturnType<typeof usePageDraw>;

interface PageTextLayerProps {
  draw: PageDraw;
  /** Die Ebene selbst – `PageDeck` misst sie (ResizeObserver) und rechnet Tipp-Positionen darauf um. */
  layerRef: MutableRefObject<HTMLDivElement | null>;
  /** Ref-Setter der Inline-Eingabe; die Tastatur-Logik im Elternteil braucht das Element. */
  editRef: (n: HTMLSpanElement | null) => void;
  /** Seitenverhältnis der dargestellten Seite („1240 / 1754"). */
  aspect: string;
  /** Texte der angesehenen fremden Ebene (nur lesend). */
  overlayTexts: PageTextObj[];
  /** Eigene Texte zeigen? (Beim Ansehen einer fremden Ebene ohne Vorschau: nein.) */
  showOwn: boolean;
  drawMode: boolean;
  drawTool: DrawTool;
  /**
   * Ist dieser Slot die aktive Hälfte? Auf der inaktiven Seite sind Texte durchlässig (#53): Der
   * Tipp fällt auf die Ebene durch und aktiviert die Seite, statt einen Text auszuwählen.
   */
  interactive: boolean;
  /** Farbe/Größe/Stil für NEU platzierten Text. */
  drawColor: string;
  textSize: number;
  textStyle: TextStyle;
  onLayerDown: (e: ReactPointerEvent) => void;
  /** Offene Inline-Eingabe übernehmen (leerer Text = verwerfen). */
  onCommit: () => void;
  /** Inline-Eingabe fokussieren – MUSS synchron in der Tipp-Geste laufen (iOS-Tastatur). */
  onFocusEditor: () => void;
  onResizeDown: (e: ReactPointerEvent, id: number, size: number) => void;
  onResizeMove: (e: ReactPointerEvent) => void;
  onResizeUp: (e: ReactPointerEvent) => void;
}

/**
 * Text-Ebene EINER sichtbaren Seite: fremde Texte (lesend), eigene Texte samt Auswahlrahmen und
 * Zieh-Knopf, sowie die Inline-Eingabe mit blinkendem Cursor (#193 – vorher ~140 Zeilen JSX
 * mitten in `PageDeck`).
 *
 * Die Ebene liegt deckungsgleich über der Anmerkungs-Canvas. Sie ist nur im Text-Werkzeug
 * anfassbar – mit Stift/Marker soll man ungehindert DARÜBER zeichnen können, sonst „fängt" der
 * Text die Eingabe ab.
 */
export function PageTextLayer({
  draw: d,
  layerRef,
  editRef,
  aspect,
  overlayTexts,
  showOwn,
  drawMode,
  drawTool,
  interactive,
  drawColor,
  textSize,
  textStyle,
  onLayerDown,
  onCommit,
  onFocusEditor,
  onResizeDown,
  onResizeMove,
  onResizeUp,
}: PageTextLayerProps) {
  const textTool = drawMode && drawTool === 'text';

  return (
    <div
      ref={layerRef}
      className={styles.textLayer}
      style={{ aspectRatio: aspect, pointerEvents: textTool ? 'all' : 'none' }}
      onPointerDown={onLayerDown}
    >
      {/* Texte der gerade angesehenen fremden Ebene (nur lesend). */}
      {overlayTexts.map((o) => (
        <div
          key={`ov-${o.id}`}
          className={styles.textObj}
          style={{ ...textObjStyle(o), pointerEvents: 'none' }}
        >
          {o.text}
        </div>
      ))}

      {showOwn &&
        d.texts
          // Gerade bearbeiteter Text wird durch die Inline-Eingabe ersetzt.
          .filter((o) => o.id !== d.pending?.editId)
          .map((o) => (
            <div
              key={o.id}
              className={`${styles.textObj}${o.id === d.selectedId ? ' ' + styles.textSel : ''}`}
              style={{
                ...textObjStyle(o),
                pointerEvents: textTool && interactive ? 'all' : 'none',
                cursor: 'grab',
              }}
              onPointerDown={(e) => d.startDrag(e, o)}
              onPointerMove={(e) => d.moveDrag(e, o.id)}
              onPointerUp={() => {
                // endDrag entscheidet: Tipp auf ausgewählten Text → bearbeiten. flushSync hängt die
                // Eingabe sofort ein, danach synchron fokussieren → iOS öffnet die Tastatur.
                flushSync(() => d.endDrag());
                onFocusEditor();
              }}
              onPointerCancel={d.endDrag}
            >
              {o.text}
              {/* Zieh-Knopf (Ecke unten rechts) am ausgewählten Text: Größe ändern. */}
              {o.id === d.selectedId && textTool && (
                <span
                  className={styles.textHandle}
                  onPointerDown={(e) => onResizeDown(e, o.id, o.sizeCqh)}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeUp}
                  onPointerCancel={onResizeUp}
                  aria-label="Textgröße ändern"
                />
              )}
            </div>
          ))}

      {/* Inline-Eingabe: blinkender Cursor direkt an der Tipp-Stelle. */}
      {d.pending &&
        (() => {
          const p = d.pending;
          const editing = p.editId != null ? d.texts.find((t) => t.id === p.editId) : null;
          // Beim Bearbeiten den Stil des Textes, sonst den aktuellen Pinsel-Stil.
          const st: TextStyle = editing
            ? {
                bold: editing.bold ?? true,
                italic: !!editing.italic,
                underline: !!editing.underline,
                align: editing.align ?? 'center',
              }
            : textStyle;
          return (
            <span
              key={`edit-${p.editId ?? 'new'}`}
              ref={(n) => {
                editRef(n);
                // Nur den Startinhalt setzen; der Fokus passiert synchron in der Tipp-Geste
                // (onFocusEditor nach flushSync) → nötig für die iOS-Tastatur.
                if (n && !n.dataset.init) {
                  n.dataset.init = '1';
                  n.textContent = p.initial ?? '';
                }
              }}
              contentEditable
              suppressContentEditableWarning
              className={`${styles.textObj} ${styles.textEditing}`}
              style={{
                left: `${(editing?.fx ?? p.fx) * 100}%`,
                top: `${(editing?.fy ?? p.fy) * 100}%`,
                fontSize: `${editing?.sizeCqh ?? textSize}cqh`,
                color: editing?.color ?? drawColor,
                fontWeight: st.bold ? 700 : 400,
                fontStyle: st.italic ? 'italic' : 'normal',
                textDecoration: st.underline ? 'underline' : 'none',
                textAlign: st.align,
                pointerEvents: 'all',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={onCommit}
              onKeyDown={(e) => {
                // Enter = Zeilenumbruch (Standard-Verhalten); Fertigstellen durch Tippen daneben.
                // Escape bricht ab.
                if (e.key === 'Escape') {
                  e.preventDefault();
                  d.cancelText();
                }
              }}
            />
          );
        })()}
    </div>
  );
}
