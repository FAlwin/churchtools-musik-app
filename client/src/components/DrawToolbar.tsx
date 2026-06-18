import type { DrawTool } from '../types/index';
import { Icon } from './icons';
import styles from './DrawToolbar.module.scss';

interface DrawToolbarProps {
  colors: string[];
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  textSize: number;
  setTextSize: (fn: (s: number) => number) => void;
  onClear: () => void;
  /** Ist eine vorhandene Text-Anmerkung ausgewählt? Dann wirken Farbe/Größe auf sie. */
  isTextSelected: boolean;
  /** Farbe der ausgewählten Anmerkung (für die Markierung der Farbfelder). */
  selectedColor?: string;
  /** Größe der ausgewählten Anmerkung (für die Anzeige). */
  selectedSize?: number;
  /** Farbe der ausgewählten Anmerkung ändern. */
  onSelectedColor: (c: string) => void;
  /** Größe der ausgewählten Anmerkung ändern (Delta). */
  onSelectedResize: (delta: number) => void;
  /** Letzte Anmerkungs-Aktion rückgängig machen. */
  onUndo: () => void;
  /** Gibt es etwas zum Rückgängigmachen? */
  canUndo: boolean;
  /** Rückgängig gemachte Aktion wiederherstellen. */
  onRedo: () => void;
  /** Gibt es etwas zum Wiederherstellen? */
  canRedo: boolean;
  /** Ausgewählten Text löschen (Knopf erscheint nur bei Auswahl). */
  onDeleteSelected: () => void;
}

/**
 * Werkzeugleiste für den Zeichenmodus (Farben, Stift/Marker/Radierer/Text, Löschen).
 * Ist ein platzierter Text ausgewählt, ändern Farbe und Größe genau diesen Text – live.
 */
export function DrawToolbar({
  colors,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  textSize,
  setTextSize,
  onClear,
  isTextSelected,
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
  // Aktive Farbe/Größe: bei ausgewähltem Text dessen Werte, sonst die Voreinstellung.
  const activeColor = isTextSelected ? selectedColor : drawColor;
  // Ist die aktive Farbe keine der Voreinstellungen → der freie Farbwähler ist aktiv.
  const isCustomColor = !!activeColor && !colors.includes(activeColor);
  const shownSize = isTextSelected ? (selectedSize ?? textSize) : textSize;
  // Größen-Regler zeigen, wenn Text-Werkzeug aktiv ODER eine Anmerkung ausgewählt ist.
  const showSize = drawTool === 'text' || isTextSelected;

  function pickColor(c: string) {
    if (isTextSelected) onSelectedColor(c);
    else setDrawColor(c);
  }
  function changeSize(delta: number) {
    if (isTextSelected) onSelectedResize(delta);
    else setTextSize((s) => Math.max(12, Math.min(56, s + delta)));
  }
  function chooseTool(t: DrawTool) {
    setDrawTool(t);
  }

  return (
    <div className={styles.toolbar}>
      {colors.map((c) => (
        <div
          key={c}
          className={`${styles.color}${activeColor === c ? ' ' + styles.on : ''}`}
          style={{ background: c }}
          onClick={() => pickColor(c)}
        />
      ))}
      <label
        className={`${styles.colorPicker}${isCustomColor ? ' ' + styles.on : ''}`}
        title="Eigene Farbe"
        style={isCustomColor && activeColor ? { background: activeColor } : undefined}
      >
        <input
          type="color"
          aria-label="Eigene Farbe wählen"
          value={isCustomColor && activeColor ? activeColor : '#888888'}
          onChange={(e) => pickColor(e.target.value)}
        />
      </label>
      <div className={styles.sep} />
      <button
        className={`${styles.toolBtn}${drawTool === 'pen' ? ' ' + styles.on : ''}`}
        onClick={() => chooseTool('pen')}
        title="Stift"
      >
        <Icon name="pencil" size={18} stroke={2} />
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'marker' ? ' ' + styles.on : ''}`}
        onClick={() => chooseTool('marker')}
        title="Marker"
      >
        <Icon name="marker" size={18} stroke={2} />
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'eraser' ? ' ' + styles.on : ''}`}
        onClick={() => chooseTool('eraser')}
        title="Radierer"
      >
        <Icon name="eraser" size={18} stroke={2} />
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'text' ? ' ' + styles.on : ''}`}
        onClick={() => chooseTool('text')}
        title="Text"
        style={{ fontSize: 13, fontWeight: 800 }}
      >
        T
      </button>
      {showSize && (
        <>
          <div className={styles.sep} />
          <button
            className={styles.toolBtn}
            onClick={() => changeSize(-4)}
            title="Kleiner"
            style={{ fontSize: 10, fontWeight: 700 }}
          >
            A−
          </button>
          <span className={styles.sizeValue}>{shownSize}</span>
          <button
            className={styles.toolBtn}
            onClick={() => changeSize(4)}
            title="Größer"
            style={{ fontSize: 10, fontWeight: 700 }}
          >
            A+
          </button>
        </>
      )}
      {isTextSelected && (
        <>
          <div className={styles.sep} />
          <button className={styles.clear} onClick={onDeleteSelected} title="Text löschen" style={{ fontSize: 15 }}>
            🗑
          </button>
        </>
      )}
      <div className={styles.sep} />
      <button className={styles.toolBtn} onClick={onUndo} disabled={!canUndo} title="Rückgängig" style={{ fontSize: 19 }}>
        ↺
      </button>
      <button className={styles.toolBtn} onClick={onRedo} disabled={!canRedo} title="Wiederherstellen" style={{ fontSize: 19 }}>
        ↻
      </button>
      <button className={styles.clear} onClick={onClear} title="Alles löschen">
        ✕
      </button>
    </div>
  );
}
