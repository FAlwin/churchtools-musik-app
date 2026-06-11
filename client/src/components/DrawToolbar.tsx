import type { DrawTool } from '../types/index';
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
}

/** Werkzeugleiste für den Zeichenmodus (Farben, Stift/Marker/Radierer/Text, Löschen). */
export function DrawToolbar({
  colors,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  setTextSize,
  onClear,
}: DrawToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {colors.map((c) => (
        <div
          key={c}
          className={`${styles.color}${drawColor === c ? ' ' + styles.on : ''}`}
          style={{ background: c }}
          onClick={() => setDrawColor(c)}
        />
      ))}
      <div className={styles.sep} />
      <button
        className={`${styles.toolBtn}${drawTool === 'pen' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('pen')}
        title="Stift"
        style={{ fontSize: 17 }}
      >
        ✏️
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'marker' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('marker')}
        title="Marker"
        style={{ fontSize: 17 }}
      >
        🖍️
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'eraser' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('eraser')}
        title="Radierer"
        style={{ fontSize: 17 }}
      >
        🧽
      </button>
      <button
        className={`${styles.toolBtn}${drawTool === 'text' ? ' ' + styles.on : ''}`}
        onClick={() => setDrawTool('text')}
        title="Text"
        style={{ fontSize: 13, fontWeight: 800 }}
      >
        T
      </button>
      {drawTool === 'text' && (
        <>
          <div className={styles.sep} />
          <button
            className={styles.toolBtn}
            onClick={() => setTextSize((s) => Math.max(12, s - 4))}
            style={{ fontSize: 10, fontWeight: 700 }}
          >
            S−
          </button>
          <button
            className={styles.toolBtn}
            onClick={() => setTextSize((s) => Math.min(56, s + 4))}
            style={{ fontSize: 10, fontWeight: 700 }}
          >
            S+
          </button>
        </>
      )}
      <div className={styles.sep} />
      <button className={styles.clear} onClick={onClear} title="Alles löschen">
        ✕
      </button>
    </div>
  );
}
