import { useEffect, useRef, useState } from 'react';
import type { DrawTool } from '../types/index';
import { Icon } from './icons';
import styles from './DrawToolbar.module.scss';

interface DrawToolbarProps {
  colors: string[];
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  onClear: () => void;
  /** Text-Werkzeug anbieten? (PDF-Viewer: aktuell nur Freihand → false) */
  allowText?: boolean;
  textSize?: number;
  setTextSize?: (fn: (s: number) => number) => void;
  /** Schrittweite/Grenzen der Textgröße. */
  sizeStep?: number;
  sizeMin?: number;
  sizeMax?: number;
  /** Formatiert den (internen) Größenwert für die Anzeige – z. B. cqh → gerundete „pt". */
  sizeLabel?: (v: number) => string;
  /** Ist eine vorhandene Text-Anmerkung ausgewählt? Dann wirken Farbe/Größe auf sie. */
  isTextSelected?: boolean;
  selectedColor?: string;
  selectedSize?: number;
  onSelectedColor?: (c: string) => void;
  onSelectedResize?: (delta: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onDeleteSelected?: () => void;
  /** Strichstärke je Werkzeug + Setter (erneuter Tipp auf das aktive Werkzeug öffnet die Auswahl). */
  toolSizes?: { pen: number; marker: number; eraser: number };
  onToolSize?: (tool: 'pen' | 'marker' | 'eraser', size: number) => void;
}

// Voreingestellte Strichstärken je Werkzeug (Canvas-Pixel bei Renderskala 2) – von fein bis
// richtig dick (Marker/Radierer bis „Flächen-Format").
const TOOL_SIZE_PRESETS: Record<'pen' | 'marker' | 'eraser', number[]> = {
  pen: [2, 3, 5, 10, 16],
  marker: [12, 18, 28, 44, 64],
  eraser: [16, 26, 44, 72, 110],
};

/**
 * Aufgeräumte, vertikale Werkzeugleiste für den Zeichenmodus (rechter Rand): ein Farbknopf mit
 * Aufklapp-Palette, dann Werkzeuge (Stift/Marker/Radierer/Text), Größe und Aktionen
 * (Rückgängig/Wiederholen/Löschen) – jeweils klar gruppiert, einheitliche Icons.
 * Ist ein platzierter Text ausgewählt, ändern Farbe und Größe genau diesen Text – live.
 */
export function DrawToolbar({
  colors,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  onClear,
  allowText = true,
  textSize = 20,
  setTextSize,
  sizeStep = 4,
  sizeMin = 12,
  sizeMax = 56,
  sizeLabel,
  isTextSelected = false,
  selectedColor,
  selectedSize,
  onSelectedColor,
  onSelectedResize,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDeleteSelected,
  toolSizes,
  onToolSize,
}: DrawToolbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const colorWrapRef = useRef<HTMLDivElement>(null);
  // Offenes Größen-Popover für ein Zeichenwerkzeug (erneuter Tipp auf das aktive Werkzeug).
  const [sizeTool, setSizeTool] = useState<'pen' | 'marker' | 'eraser' | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Aktive Farbe/Größe: bei ausgewähltem Text dessen Werte, sonst die Voreinstellung.
  const activeColor = (isTextSelected ? selectedColor : drawColor) ?? drawColor;
  const isCustomColor = !!activeColor && !colors.includes(activeColor);
  const shownSize = isTextSelected ? (selectedSize ?? textSize) : textSize;
  const showSize = drawTool === 'text' || isTextSelected;
  const showUndo = !!onUndo;

  // Palette bei Klick außerhalb schließen.
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: PointerEvent) => {
      if (colorWrapRef.current && !colorWrapRef.current.contains(e.target as Node)) setPaletteOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [paletteOpen]);

  function pickColor(c: string) {
    if (isTextSelected) onSelectedColor?.(c);
    else setDrawColor(c);
    setPaletteOpen(false);
  }
  function changeSize(delta: number) {
    if (isTextSelected) onSelectedResize?.(delta);
    else setTextSize?.((s) => Math.max(sizeMin, Math.min(sizeMax, s + delta)));
  }
  // Werkzeug wählen; erneuter Tipp auf das AKTIVE Zeichenwerkzeug öffnet die Strichstärke-Auswahl.
  function chooseTool(t: DrawTool) {
    if ((t === 'pen' || t === 'marker' || t === 'eraser') && t === drawTool && onToolSize) {
      setSizeTool((cur) => (cur === t ? null : t));
      return;
    }
    setDrawTool(t);
    setSizeTool(null);
  }

  // Strichstärke-Popover bei Klick außerhalb schließen.
  useEffect(() => {
    if (!sizeTool) return;
    const onDown = (e: PointerEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setSizeTool(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [sizeTool]);

  return (
    <div className={styles.toolbar}>
      {/* Farbe: ein Knopf zeigt die aktuelle Farbe, Tippen öffnet die Palette. */}
      <div className={styles.colorWrap} ref={colorWrapRef}>
        <button
          className={styles.colorBtn}
          style={{ background: activeColor }}
          onClick={() => setPaletteOpen((v) => !v)}
          aria-label="Farbe wählen"
          aria-expanded={paletteOpen}
        />
        {paletteOpen && (
          <div className={styles.palette}>
            {colors.map((c) => (
              <button
                key={c}
                className={`${styles.swatch}${activeColor === c ? ' ' + styles.swatchOn : ''}`}
                style={{ background: c }}
                onClick={() => pickColor(c)}
                aria-label={`Farbe ${c}`}
              />
            ))}
            <label
              className={`${styles.swatch} ${styles.swatchCustom}${isCustomColor ? ' ' + styles.swatchOn : ''}`}
              title="Eigene Farbe"
              style={isCustomColor && activeColor ? { background: activeColor } : undefined}
            >
              {/* „+" bleibt IMMER sichtbar → auch bei aktiver eigener Farbe erkennbar als Wähler. */}
              <Icon name="plus" size={18} stroke={2.4} className={styles.customPlus} />
              <input
                type="color"
                aria-label="Eigene Farbe wählen"
                value={isCustomColor && activeColor ? activeColor : '#888888'}
                onChange={(e) => pickColor(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className={styles.sep} />

      {/* Werkzeuge – erneuter Tipp auf das aktive Zeichenwerkzeug öffnet die Strichstärke. */}
      <div className={styles.toolsGroup} ref={toolsRef}>
        {(['pen', 'marker', 'eraser'] as const).map((t) => (
          <button
            key={t}
            className={`${styles.toolBtn}${drawTool === t ? ' ' + styles.on : ''}`}
            onClick={() => chooseTool(t)}
            title={t === 'pen' ? 'Stift' : t === 'marker' ? 'Marker' : 'Radierer'}
            aria-label={t === 'pen' ? 'Stift' : t === 'marker' ? 'Marker' : 'Radierer'}
          >
            <Icon name={t === 'pen' ? 'pencil' : t === 'marker' ? 'marker' : 'eraser'} size={20} stroke={2} />
          </button>
        ))}
        {allowText && (
          <button
            className={`${styles.toolBtn}${drawTool === 'text' ? ' ' + styles.on : ''}`}
            onClick={() => chooseTool('text')}
            title="Text"
            aria-label="Text"
          >
            <Icon name="type" size={20} stroke={2} />
          </button>
        )}
        {/* Strichstärke-Popover (links) für das aktive Zeichenwerkzeug */}
        {sizeTool && toolSizes && onToolSize && (
          <div className={styles.sizePopover}>
            {TOOL_SIZE_PRESETS[sizeTool].map((sz) => {
              const active = toolSizes[sizeTool] === sz;
              // Wurzel-Skala: auch die dicken Stufen (bis 110) bleiben als Punkt im Knopf
              // darstellbar und trotzdem klar voneinander unterscheidbar.
              const dot = Math.max(5, Math.min(30, Math.round(3.2 * Math.sqrt(sz))));
              return (
                <button
                  key={sz}
                  className={`${styles.sizeOpt}${active ? ' ' + styles.sizeOptOn : ''}`}
                  onClick={() => {
                    onToolSize(sizeTool, sz);
                    setSizeTool(null);
                  }}
                  aria-label={`Stärke ${sz}`}
                >
                  <span className={styles.sizeDot} style={{ width: dot, height: dot }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Größe (nur bei Text-Werkzeug oder ausgewähltem Text) */}
      {showSize && (
        <>
          <div className={styles.sep} />
          <button className={styles.toolBtn} onClick={() => changeSize(-sizeStep)} title="Kleiner" aria-label="Kleiner">
            <span className={styles.sizeBtnLabel}>A−</span>
          </button>
          <span className={styles.sizeValue}>{sizeLabel ? sizeLabel(shownSize) : Math.round(shownSize)}</span>
          <button className={styles.toolBtn} onClick={() => changeSize(sizeStep)} title="Größer" aria-label="Größer">
            <span className={styles.sizeBtnLabel}>A+</span>
          </button>
        </>
      )}

      {/* Aktionen */}
      <div className={styles.sep} />
      {isTextSelected && onDeleteSelected && (
        <button className={styles.toolBtn} onClick={onDeleteSelected} title="Text löschen" aria-label="Text löschen">
          <Icon name="trash" size={19} stroke={2} />
        </button>
      )}
      {showUndo && (
        <>
          <button className={styles.toolBtn} onClick={onUndo} disabled={!canUndo} title="Rückgängig" aria-label="Rückgängig">
            <Icon name="undo" size={19} stroke={2} />
          </button>
          <button className={styles.toolBtn} onClick={onRedo} disabled={!canRedo} title="Wiederherstellen" aria-label="Wiederherstellen">
            <Icon name="redo" size={19} stroke={2} />
          </button>
        </>
      )}
      <button className={styles.clear} onClick={onClear} title="Alles löschen" aria-label="Alles löschen">
        <Icon name="trash" size={19} stroke={2} />
      </button>
    </div>
  );
}
