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
}

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
}: DrawToolbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const colorWrapRef = useRef<HTMLDivElement>(null);

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

      {/* Werkzeuge */}
      <button
        className={`${styles.toolBtn}${drawTool === 'pen' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('pen')}
        title="Stift"
        aria-label="Stift"
      >
        <Icon name="pencil" size={20} stroke={2} />
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'marker' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('marker')}
        title="Marker"
        aria-label="Marker"
      >
        <Icon name="marker" size={20} stroke={2} />
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'eraser' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('eraser')}
        title="Radierer"
        aria-label="Radierer"
      >
        <Icon name="eraser" size={20} stroke={2} />
      </button>
      {allowText && (
        <button
          className={`${styles.toolBtn}${drawTool === 'text' ? ' ' + styles.on : ''}`}
          onClick={() => setDrawTool('text')}
          title="Text"
          aria-label="Text"
        >
          <Icon name="type" size={20} stroke={2} />
        </button>
      )}

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
