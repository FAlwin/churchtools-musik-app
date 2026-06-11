import { useEffect, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { DrawToolbar } from '../components/DrawToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { parseChordPro } from '../utils/chordpro';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { DRAW_COLORS, fontFamilyById } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useWakeLock } from '../hooks/useWakeLock';
import { useDrawing } from '../hooks/useDrawing';
import { usePagedColumns } from '../hooks/usePagedColumns';
import type { DrawTool, Theme } from '../types/index';
import styles from './ChordChart.module.scss';

// Innenabstand und Spaltenabstand des Chart-Inhalts (für die Spaltenbreite)
const CONTENT_PAD = 24;
const COLUMN_GAP = 40;

interface ChordChartProps {
  songs: SetlistSong[];
  startIndex: number;
  onBack: () => void;
  onReload?: () => void;
  reloading?: boolean;
  theme: Theme;
  wakePref: boolean;
  fontId: string;
}

/** Chord-Chart-Anzeige mit Transponieren, Kapo, Ansichtsmodi und Zeichnen. */
export function ChordChart({
  songs,
  startIndex,
  onBack,
  onReload,
  reloading,
  theme,
  wakePref,
  fontId,
}: ChordChartProps) {
  const [idx, setIdx] = useState(startIndex);
  const song = songs[idx];

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => localStorage.getItem(`worship_key_${song.id}`) || null,
  );
  const [capo, setCapo] = useState(() => parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
  const [fontSize, setFontSize] = useLocalStorage<number>('worship_fs', 20);
  const [lyricsOnly, setLyricsOnly] = useLocalStorage<boolean>('worship_lyrics_only', false);
  const [cols, setCols] = useState(1);

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [textSize, setTextSize] = useState(20);

  const textInputRef = useRef<HTMLInputElement | null>(null);

  useWakeLock(wakePref);

  // ── abgeleitete Werte ──
  const curKey = selectedKey || song.targetKey;
  const totalOffset = getSemitoneOffset(song.originalKey, curKey);
  const gripOffset = totalOffset - capo; // Griff-Akkorde (mit Kapo)
  const shapeKey = shiftKey(curKey, -capo);
  const sections = parseChordPro(song.chordpro);
  const fontFam = fontFamilyById(fontId);
  // Schwarz im Dark Mode auf Creme umstellen, damit sichtbar
  const drawColors = DRAW_COLORS.map((c) => (c === '#14110F' ? (theme === 'dark' ? '#FFFCF2' : '#14110F') : c));

  const drawing = useDrawing({
    songId: song.id,
    drawMode,
    drawColor,
    drawTool,
    textSize,
    layoutDeps: [fontSize, cols, lyricsOnly, fontId, drawMode],
  });

  // Breite des Chart-Bereichs messen (für die Spaltenbreite je Seite)
  const [bodyWidth, setBodyWidth] = useState(0);
  useEffect(() => {
    const el = drawing.bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setBodyWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spaltenbreite so, dass genau `cols` Spalten eine Seite füllen
  const colWidthPx =
    bodyWidth > 0
      ? Math.floor((bodyWidth - 2 * CONTENT_PAD - (cols - 1) * COLUMN_GAP) / cols)
      : undefined;

  const paged = usePagedColumns(drawing.bodyRef, [song.id, fontSize, cols, lyricsOnly, fontId, bodyWidth]);

  // ── Persistenz pro Song / beim Songwechsel zurücksetzen ──
  useEffect(() => {
    setSelectedKey(localStorage.getItem(`worship_key_${song.id}`) || null);
    setCapo(parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
    if (drawing.bodyRef.current) drawing.bodyRef.current.scrollLeft = 0; // zurück auf Seite 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, song.id]);

  useEffect(() => {
    if (selectedKey) localStorage.setItem(`worship_key_${song.id}`, selectedKey);
    else localStorage.removeItem(`worship_key_${song.id}`);
  }, [selectedKey, song.id]);

  useEffect(() => {
    localStorage.setItem(`worship_capo_${song.id}`, String(capo));
  }, [capo, song.id]);

  // ── Navigation ──
  function prev() {
    if (idx > 0) {
      drawing.saveDrawing(song.id);
      setIdx(idx - 1);
    }
  }
  function next() {
    if (idx < songs.length - 1) {
      drawing.saveDrawing(song.id);
      setIdx(idx + 1);
    }
  }
  function goBack() {
    drawing.saveDrawing(song.id);
    onBack();
  }

  function clearDrawing() {
    drawing.clearAll();
    setConfirmClear(false);
  }

  return (
    <Screen className={styles.chartScreen}>
      <>
        {/* Header */}
        <div className={styles.hdr}>
          <button className={styles.ibtn} onClick={goBack}>
            ‹
          </button>
          <div className={styles.center}>
            <button className={styles.titleBtn} onClick={() => setShowModeMenu((v) => !v)}>
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.titleChevron}>▾</span>
            </button>
            {!lyricsOnly ? (
              <div className={styles.keyRow}>
                <button className={styles.keyBtn} onClick={() => setShowKeyPicker(true)}>
                  <span className={styles.keyLabel}>{curKey}</span>
                  <span className={styles.keyChevron}>▾</span>
                </button>
                {capo > 0 && <span className={styles.capoBadge}>Capo {capo}</span>}
              </div>
            ) : (
              <div className={styles.keyRow}>
                <span className={styles.modeHint}>Nur Text</span>
              </div>
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.azGroup}>
              {onReload && (
                <button
                  className={styles.azBtn}
                  onClick={onReload}
                  disabled={reloading}
                  title="Aktualisieren"
                >
                  <span className={reloading ? styles.spin : undefined}>↻</span>
                </button>
              )}
              <button className={styles.azBtn} onClick={() => setFontSize((f) => Math.max(14, f - 2))}>
                A−
              </button>
              <button className={styles.azBtn} onClick={() => setFontSize((f) => Math.min(32, f + 2))}>
                A+
              </button>
              <button
                className={`${styles.azBtn} ${styles.colTog}${cols === 2 ? ' ' + styles.on : ''}`}
                onClick={() => setCols((c) => (c === 1 ? 2 : 1))}
                title="Spalten"
              >
                ⊞
              </button>
              <button
                className={`${styles.azBtn}${drawMode ? ' ' + styles.on : ''}`}
                onClick={() => setDrawMode((d) => !d)}
                title="Markierungen"
              >
                ✏
              </button>
            </div>
            {song.bpm !== null && <span className={styles.bpmChip}>♩ {song.bpm}</span>}
          </div>
        </div>

        {/* Mode-Menü */}
        {showModeMenu && (
          <>
            <div className={styles.scrim} onClick={() => setShowModeMenu(false)} />
            <div className={styles.modeMenu}>
              <div className={styles.menuLbl}>Ansicht</div>
              <button
                className={`${styles.mmItem}${!lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  setLyricsOnly(false);
                  setShowModeMenu(false);
                }}
              >
                <span>Akkorde &amp; Text</span>
                {!lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              <button
                className={`${styles.mmItem}${lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  setLyricsOnly(true);
                  setShowModeMenu(false);
                }}
              >
                <span>Nur Text</span>
                {lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                Optionen
              </div>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowCapoPicker(true);
                  setShowModeMenu(false);
                }}
              >
                <span>Kapo</span>
                {capo > 0 ? (
                  <span className={styles.mmValueActive}>Bund {capo}</span>
                ) : (
                  <span className={styles.mmValue}>–</span>
                )}
              </button>
            </div>
          </>
        )}

        {/* Tonart-Picker */}
        {showKeyPicker && (
          <KeyPicker
            currentKey={curKey}
            defaultKey={song.targetKey}
            isCustom={selectedKey !== null}
            onPick={(k) => {
              setSelectedKey(k);
              setShowKeyPicker(false);
            }}
            onReset={() => {
              setSelectedKey(null);
              setShowKeyPicker(false);
            }}
            onClose={() => setShowKeyPicker(false)}
          />
        )}

        {/* Kapo-Picker */}
        {showCapoPicker && (
          <CapoPicker
            capo={capo}
            shapeKey={shapeKey}
            soundingKey={curKey}
            onPick={(c) => {
              setCapo(c);
              setShowCapoPicker(false);
            }}
            onClose={() => setShowCapoPicker(false)}
          />
        )}

        {/* Seiten-Anzeige (nur bei mehr als einer Seite) */}
        {paged.pageCount > 1 && (
          <div className={styles.pageChip}>
            {paged.page + 1} / {paged.pageCount}
          </div>
        )}

        {/* Chart-Body – seitenweise Spalten, horizontal blättern */}
        <div
          className={styles.body}
          ref={drawing.bodyRef}
          onScroll={paged.onScroll}
          style={{ ['--chart-font' as string]: fontFam }}
        >
          <div
            className={styles.content}
            style={{ columnWidth: colWidthPx ? `${colWidthPx}px` : undefined, columnGap: COLUMN_GAP }}
          >
            {sections.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎵</div>
                <div>Für dieses Lied ist keine Akkord-Datei in ChurchTools hinterlegt.</div>
              </div>
            ) : (
              sections.map((sec, i) => (
                <Section
                  key={i}
                  section={sec}
                  semitones={gripOffset}
                  fontSize={fontSize}
                  lyricsOnly={lyricsOnly}
                />
              ))
            )}
          </div>
          <canvas
            ref={drawing.canvasRef}
            className={`${styles.canvas}${drawMode ? ' ' + styles.active : ''}`}
            onPointerDown={drawing.handlers.onPointerDown}
            onPointerMove={drawing.handlers.onPointerMove}
            onPointerUp={drawing.handlers.onPointerUp}
            onPointerLeave={drawing.handlers.onPointerUp}
          />
          {drawing.textObjects.map((obj) => (
            <div
              key={obj.id}
              className={styles.textObj}
              style={{
                top: obj.y - obj.size,
                left: obj.x,
                fontSize: obj.size,
                color: obj.color,
                pointerEvents: drawMode ? 'all' : 'none',
                cursor: drawMode ? 'grab' : 'default',
              }}
              onPointerDown={drawMode ? (e) => drawing.startDragText(e, obj) : undefined}
              onPointerMove={drawMode ? (e) => drawing.moveDragText(e, obj.id) : undefined}
              onPointerUp={drawMode ? drawing.endDragText : undefined}
            >
              {obj.text}
              {drawMode && (
                <button
                  className={styles.textObjDel}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    drawing.deleteText(obj.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Zeichen-Werkzeugleiste */}
        {drawMode && (
          <DrawToolbar
            colors={drawColors}
            drawColor={drawColor}
            setDrawColor={setDrawColor}
            drawTool={drawTool}
            setDrawTool={setDrawTool}
            textSize={textSize}
            setTextSize={setTextSize}
            onClear={() => setConfirmClear(true)}
          />
        )}

        {/* Text-Eingabe-Overlay */}
        {drawing.pendingText && drawMode && (
          <div
            className={styles.textInputWrap}
            style={{ left: drawing.pendingText.cx, top: drawing.pendingText.cy }}
          >
            <input
              ref={textInputRef}
              type="text"
              autoFocus
              placeholder="Text..."
              className={styles.textInput}
              style={{ color: drawColor, border: `2px solid ${drawColor}`, fontSize: textSize }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') drawing.confirmText((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') drawing.confirmText('');
              }}
              onBlur={(e) => drawing.confirmText(e.target.value)}
            />
          </div>
        )}

        {/* Löschen bestätigen */}
        {confirmClear && (
          <ConfirmDialog
            title="Markierungen löschen?"
            message={`Alle Zeichnungen auf „${song.title}" werden entfernt. Das kann nicht rückgängig gemacht werden.`}
            confirmLabel="Löschen"
            onConfirm={clearDrawing}
            onCancel={() => setConfirmClear(false)}
          />
        )}

        {/* Footer */}
        <div className={styles.ftr}>
          <button className={styles.navBtn} onClick={prev} disabled={idx === 0}>
            ‹
          </button>
          <div className={styles.ftrCenter}>
            <div className={styles.dots}>
              {songs.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.dot}${i === idx ? ' ' + styles.on : ''}`}
                  onClick={() => {
                    drawing.saveDrawing(song.id);
                    setIdx(i);
                  }}
                />
              ))}
            </div>
            <div className={styles.ftrLabel}>
              {idx + 1} / {songs.length}
              {idx < songs.length - 1 && (
                <span className={styles.ftrNext}> · weiter: {songs[idx + 1].title}</span>
              )}
            </div>
          </div>
          <button className={styles.navBtn} onClick={next} disabled={idx === songs.length - 1}>
            ›
          </button>
        </div>
      </>
    </Screen>
  );
}
