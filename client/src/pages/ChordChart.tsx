import { useEffect, useRef, useState } from 'react';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { DrawToolbar } from '../components/DrawToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { DocumentViewer } from '../components/DocumentViewer';
import { Sheet } from '../components/Sheet';
import { saveChordpro, deleteChordpro } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { parseChordPro } from '../utils/chordpro';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { DRAW_COLORS, fontFamilyById } from '../utils/constants';
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
  // Schriftgröße, Spalten und Ansicht werden je Lied gespeichert
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10));
  const [cols, setCols] = useState(() => parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10));
  const [lyricsOnly, setLyricsOnly] = useState(() => localStorage.getItem(`worship_lyrics_${song.id}`) === '1');

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Editor + Versionswahl (ECG-Bearbeitung vs. Original)
  const [showEditor, setShowEditor] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [activeDoc, setActiveDoc] = useState<SongDocument | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [textSize, setTextSize] = useState(20);

  const textInputRef = useRef<HTMLInputElement | null>(null);
  const touchX = useRef<number | null>(null);
  const touchScroll = useRef<number>(0);
  const pendingLastPage = useRef(false);
  const slideDir = useRef<'right' | 'left'>('right'); // Richtung des Liedwechsel-Übergangs

  useWakeLock(wakePref);

  // ── abgeleitete Werte ──
  const curKey = selectedKey || song.targetKey;
  const totalOffset = getSemitoneOffset(song.originalKey, curKey);
  const gripOffset = totalOffset - capo; // Griff-Akkorde (mit Kapo)
  const shapeKey = shiftKey(curKey, -capo);
  const hasEcg = song.chordproEcg !== null;
  const displayedChordpro = !showOriginal && song.chordproEcg ? song.chordproEcg : song.chordpro;
  const sections = parseChordPro(displayedChordpro);
  // Startvorlage, wenn noch gar kein Text existiert (neues Lied erfassen)
  const editorInitial =
    displayedChordpro ||
    `{title: ${song.title}}\n{key: ${song.targetKey || song.originalKey || 'C'}}\n\n{comment: Vers 1}\n[${song.targetKey || 'C'}]Hier Text mit Akkorden eingeben\n\n{comment: Chorus}\n`;
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

  // Sichtbare Breite messen (für die Spaltenbreite je Seite)
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    const el = drawing.bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setPageWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setPageWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spaltenbreite so, dass genau `cols` Spalten eine Seite füllen
  const colWidthPx =
    pageWidth > 0
      ? Math.floor((pageWidth - 2 * CONTENT_PAD - (cols - 1) * COLUMN_GAP) / cols)
      : undefined;

  const paged = usePagedColumns(drawing.bodyRef, drawing.contentRef, [
    song.id,
    fontSize,
    cols,
    lyricsOnly,
    fontId,
    pageWidth,
  ]);

  // ── Persistenz pro Song: beim Liedwechsel die gespeicherten Werte laden ──
  useEffect(() => {
    setSelectedKey(localStorage.getItem(`worship_key_${song.id}`) || null);
    setCapo(parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
    setFontSize(parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10));
    setCols(parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10));
    setLyricsOnly(localStorage.getItem(`worship_lyrics_${song.id}`) === '1');
    setShowOriginal(false); // beim Liedwechsel wieder die bevorzugte Version zeigen
    setActiveDoc(null);
    setShowDocPicker(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, song.id]);

  // Dokument öffnen: bei einem direkt, bei mehreren Auswahl zeigen
  function openDocuments() {
    setShowSongMenu(false);
    if (song.documents.length === 1) setActiveDoc(song.documents[0]);
    else if (song.documents.length > 1) setShowDocPicker(true);
  }

  useEffect(() => {
    localStorage.setItem(`worship_fs_${song.id}`, String(fontSize));
  }, [fontSize, song.id]);
  useEffect(() => {
    localStorage.setItem(`worship_cols_${song.id}`, String(cols));
  }, [cols, song.id]);
  useEffect(() => {
    localStorage.setItem(`worship_lyrics_${song.id}`, lyricsOnly ? '1' : '0');
  }, [lyricsOnly, song.id]);

  // Beim Songwechsel auf Seite 1 (oder ans Ende, wenn rückwärts geblättert)
  useEffect(() => {
    const el = drawing.bodyRef.current;
    if (!el) return;
    const r = requestAnimationFrame(() => {
      el.scrollLeft = pendingLastPage.current ? el.scrollWidth : 0;
      pendingLastPage.current = false;
    });
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, song.id, pageWidth, fontSize, cols, lyricsOnly]);

  useEffect(() => {
    if (selectedKey) localStorage.setItem(`worship_key_${song.id}`, selectedKey);
    else localStorage.removeItem(`worship_key_${song.id}`);
  }, [selectedKey, song.id]);

  useEffect(() => {
    localStorage.setItem(`worship_capo_${song.id}`, String(capo));
  }, [capo, song.id]);

  // ── Einheitliche Navigation: erst durch die Seiten, dann zum nächsten/vorigen Lied ──
  const atStart = idx === 0 && paged.page === 0;
  const atEnd = idx === songs.length - 1 && paged.page >= paged.pageCount - 1;

  function next() {
    if (paged.page < paged.pageCount - 1) {
      paged.goToPage(paged.page + 1); // innerhalb des Lieds: schneller Seitenwechsel
    } else if (idx < songs.length - 1) {
      drawing.saveDrawing(song.id);
      slideDir.current = 'right';
      setIdx(idx + 1);
    }
  }
  function prev() {
    if (paged.page > 0) {
      paged.goToPage(paged.page - 1);
    } else if (idx > 0) {
      drawing.saveDrawing(song.id);
      slideDir.current = 'left';
      pendingLastPage.current = true;
      setIdx(idx - 1);
    }
  }
  function goToSong(target: number) {
    if (target === idx) return;
    drawing.saveDrawing(song.id);
    slideDir.current = target > idx ? 'right' : 'left';
    setIdx(target);
  }
  function goBack() {
    drawing.saveDrawing(song.id);
    onBack();
  }

  // Wischen: blättert Seiten (nativer Scroll); am Seitenrand wie die Pfeile zum Lied wechseln
  function onTouchStart(e: React.TouchEvent) {
    if (drawMode) return;
    touchX.current = e.touches[0].clientX;
    touchScroll.current = drawing.bodyRef.current?.scrollLeft ?? 0;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const el = drawing.bodyRef.current;
    const d = touchX.current - e.changedTouches[0].clientX;
    touchX.current = null;
    if (!el || Math.abs(d) <= 55) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const didScroll = Math.abs(el.scrollLeft - touchScroll.current) > 4;
    if (didScroll) return; // native Seitenscroll hat schon geblättert
    if (d > 0 && el.scrollLeft >= maxScroll - 2 && idx < songs.length - 1) {
      next(); // war auf letzter Seite -> nächstes Lied
    } else if (d < 0 && el.scrollLeft <= 2 && idx > 0) {
      prev(); // war auf erster Seite -> voriges Lied
    }
  }

  // Tippen am linken/rechten Rand wirkt wie die Pfeile (Mitte = nichts)
  function onBodyClick(e: React.MouseEvent) {
    if (drawMode) return;
    const el = drawing.bodyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.26) prev();
    else if (x > rect.width * 0.74) next();
  }

  function clearDrawing() {
    drawing.clearAll();
    setConfirmClear(false);
  }

  // ── Editor: ECG-Version speichern / zurücksetzen ──
  async function handleSaveChordpro(text: string) {
    setEditorSaving(true);
    setEditorError(null);
    try {
      await saveChordpro(song.id, song.arrangementId, text);
      setShowEditor(false);
      setShowOriginal(false);
      onReload?.(); // Setlist neu laden → bearbeitete Version erscheint
    } catch (e) {
      setEditorError(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setEditorSaving(false);
    }
  }
  async function handleResetChordpro() {
    setEditorSaving(true);
    setEditorError(null);
    try {
      await deleteChordpro(song.id, song.arrangementId);
      setShowEditor(false);
      setShowOriginal(false);
      onReload?.();
    } catch (e) {
      setEditorError(e instanceof ApiError ? e.message : 'Zurücksetzen fehlgeschlagen.');
    } finally {
      setEditorSaving(false);
    }
  }

  const nextSong = idx < songs.length - 1 ? songs[idx + 1] : null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {/* Header */}
        <div className={styles.hdr}>
          <button className={styles.ibtn} onClick={goBack}>
            ‹
          </button>
          <div className={styles.center}>
            <button className={styles.titleBtn} onClick={() => setShowSongMenu((v) => !v)}>
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.titleChevron}>▾</span>
            </button>
            <div className={styles.keyRow}>
              {!lyricsOnly && <span className={styles.keyChip}>{curKey}</span>}
              {!lyricsOnly && capo > 0 && <span className={styles.capoBadge}>Capo {capo}</span>}
              {lyricsOnly && <span className={styles.modeHint}>Nur Text</span>}
              {hasEcg && <span className={styles.ecgChip}>{showOriginal ? 'Original' : 'ECG'}</span>}
              {song.bpm !== null && <span className={styles.bpmChip}>♩ {song.bpm}</span>}
            </div>
          </div>
          <div className={styles.right}>
            <button
              className={`${styles.toolBtn}${showAppearance ? ' ' + styles.on : ''}`}
              onClick={() => setShowAppearance((v) => !v)}
              title="Aussehen"
            >
              Aa
            </button>
            {onReload && (
              <button className={styles.toolBtn} onClick={onReload} disabled={reloading} title="Aktualisieren">
                <span className={reloading ? styles.spin : undefined}>↻</span>
              </button>
            )}
            <button
              className={`${styles.toolBtn}${drawMode ? ' ' + styles.on : ''}`}
              onClick={() => setDrawMode((d) => !d)}
              title="Anmerkungen"
            >
              🖍️
            </button>
          </div>
        </div>

        {/* Aussehen-Dropdown (pro Lied: Schriftgröße, Spalten, Ansicht, Kapo) */}
        {showAppearance && (
          <>
            <div className={styles.scrim} onClick={() => setShowAppearance(false)} />
            <div className={styles.appMenu}>
              <div className={styles.menuLbl}>Schriftgröße</div>
              <div className={styles.appRow}>
                <button className={styles.stepBtn} onClick={() => setFontSize((f) => Math.max(12, f - 2))}>
                  A−
                </button>
                <span className={styles.stepValue}>{fontSize}</span>
                <button className={styles.stepBtn} onClick={() => setFontSize((f) => Math.min(40, f + 2))}>
                  A+
                </button>
              </div>

              <div className={styles.menuLbl}>Spalten</div>
              <div className={styles.segGroup}>
                <button className={`${styles.segBtn}${cols === 1 ? ' ' + styles.on : ''}`} onClick={() => setCols(1)}>
                  1 Spalte
                </button>
                <button className={`${styles.segBtn}${cols === 2 ? ' ' + styles.on : ''}`} onClick={() => setCols(2)}>
                  2 Spalten
                </button>
              </div>

              <div className={styles.menuLbl}>Ansicht</div>
              <div className={styles.segGroup}>
                <button
                  className={`${styles.segBtn}${!lyricsOnly ? ' ' + styles.on : ''}`}
                  onClick={() => setLyricsOnly(false)}
                >
                  Akkorde &amp; Text
                </button>
                <button
                  className={`${styles.segBtn}${lyricsOnly ? ' ' + styles.on : ''}`}
                  onClick={() => setLyricsOnly(true)}
                >
                  Nur Text
                </button>
              </div>
            </div>
          </>
        )}

        {/* Lied-Menü (über den Titel): Transponieren, Kapo, Bearbeiten, Version */}
        {showSongMenu && (
          <>
            <div className={styles.scrim} onClick={() => setShowSongMenu(false)} />
            <div className={styles.modeMenu}>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowKeyPicker(true);
                  setShowSongMenu(false);
                }}
              >
                <span>Transponieren</span>
                <span className={styles.mmValueActive}>{curKey}</span>
              </button>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowCapoPicker(true);
                  setShowSongMenu(false);
                }}
              >
                <span>Kapo</span>
                {capo > 0 ? (
                  <span className={styles.mmValueActive}>Bund {capo}</span>
                ) : (
                  <span className={styles.mmValue}>–</span>
                )}
              </button>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowEditor(true);
                  setEditorError(null);
                  setShowSongMenu(false);
                }}
              >
                <span>Text bearbeiten</span>
                <span className={styles.mmValue}>🖉</span>
              </button>
              {song.documents.length > 0 && (
                <button className={styles.mmItem} onClick={openDocuments}>
                  <span>Dokumente (PDF/Bild)</span>
                  <span className={styles.mmValue}>{song.documents.length}</span>
                </button>
              )}
              {hasEcg && (
                <>
                  <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                    Version
                  </div>
                  <div className={styles.segGroup}>
                    <button
                      className={`${styles.segBtn}${!showOriginal ? ' ' + styles.on : ''}`}
                      onClick={() => {
                        setShowOriginal(false);
                        setShowSongMenu(false);
                      }}
                    >
                      ECG-Version
                    </button>
                    <button
                      className={`${styles.segBtn}${showOriginal ? ' ' + styles.on : ''}`}
                      onClick={() => {
                        setShowOriginal(true);
                        setShowSongMenu(false);
                      }}
                    >
                      Original
                    </button>
                  </div>
                </>
              )}
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

        {/* Chart-Bereich (fester Viewport; Body scrollt darin horizontal) */}
        <div className={styles.chartArea}>
        <div
          className={styles.body}
          ref={drawing.bodyRef}
          onScroll={paged.onScroll}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={onBodyClick}
          style={{ ['--chart-font' as string]: fontFam }}
        >
          <div
            key={song.id}
            ref={drawing.contentRef}
            className={`${styles.content} ${slideDir.current === 'right' ? styles.slideRight : styles.slideLeft}`}
            style={{ columnWidth: colWidthPx ? `${colWidthPx}px` : undefined, columnGap: COLUMN_GAP }}
          >
            {sections.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎵</div>
                <div>Für dieses Lied ist keine Akkord-Datei in ChurchTools hinterlegt.</div>
                <button
                  className={styles.createBtn}
                  onClick={() => {
                    setEditorError(null);
                    setShowEditor(true);
                  }}
                >
                  Akkord-Datei erstellen
                </button>
              </div>
            ) : (
              sections.map((sec, i) => (
                <Section key={i} section={sec} semitones={gripOffset} fontSize={fontSize} lyricsOnly={lyricsOnly} />
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

        {/* Seiten-Badge unten rechts */}
        {paged.pageCount > 1 && (
          <button className={styles.pageBadge} onClick={next}>
            Seite {paged.page + 1} / {paged.pageCount}
            <span className={styles.pageBadgeArrow}>›</span>
          </button>
        )}
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
          <div className={styles.textInputWrap} style={{ left: drawing.pendingText.cx, top: drawing.pendingText.cy }}>
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

        {/* Dokument-Auswahl (bei mehreren Dateien) */}
        {showDocPicker && (
          <Sheet title="Dokumente" onClose={() => setShowDocPicker(false)}>
            {song.documents.map((d) => (
              <button
                key={d.fileId}
                className={styles.docRow}
                onClick={() => {
                  setActiveDoc(d);
                  setShowDocPicker(false);
                }}
              >
                <span>{d.type === 'pdf' ? '📄' : '🖼️'}</span>
                <span className={styles.docName}>{d.name}</span>
              </button>
            ))}
          </Sheet>
        )}

        {/* Dokument-Viewer (Vollbild) */}
        {activeDoc && <DocumentViewer songId={song.id} doc={activeDoc} onClose={() => setActiveDoc(null)} />}

        {/* Text-Editor (Vollbild) */}
        {showEditor && (
          <ChordEditor
            songTitle={song.title}
            initialText={editorInitial}
            hasEcg={hasEcg}
            saving={editorSaving}
            error={editorError}
            onSave={handleSaveChordpro}
            onReset={handleResetChordpro}
            onClose={() => setShowEditor(false)}
          />
        )}

        {/* Footer */}
        <div className={styles.ftr}>
          <button className={styles.navBtn} onClick={prev} disabled={atStart}>
            ‹
          </button>
          <div className={styles.ftrCenter}>
            <div className={styles.dots}>
              {songs.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.dot}${i === idx ? ' ' + styles.on : ''}`}
                  onClick={() => goToSong(i)}
                />
              ))}
            </div>
            <div className={styles.ftrInfo}>
              {nextSong ? (
                <span className={styles.ftrNext}>Nächstes Lied: {nextSong.title}</span>
              ) : (
                <span className={styles.ftrSong}>Letztes Lied</span>
              )}
            </div>
          </div>
          <button className={styles.navBtn} onClick={next} disabled={atEnd}>
            ›
          </button>
        </div>
      </>
    </Screen>
  );
}
