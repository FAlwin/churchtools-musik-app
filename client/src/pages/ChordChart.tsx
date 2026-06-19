import { useEffect, useRef, useState } from 'react';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { DrawToolbar } from '../components/DrawToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { DocumentView } from '../components/DocumentView';
import { Icon } from '../components/icons';
import { saveChordpro, deleteChordpro } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { parseChordPro } from '../utils/chordpro';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { DRAW_COLORS, fontFamilyById } from '../utils/constants';
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
  /** Darf der Nutzer den ChordPro-Text bearbeiten? (blendet Editor-Funktionen aus) */
  canEditSong?: boolean;
  theme: Theme;
  fontId: string;
}

/** Chord-Chart-Anzeige mit Transponieren, Kapo, Ansichtsmodi und Zeichnen. */
export function ChordChart({
  songs,
  startIndex,
  onBack,
  onReload,
  reloading,
  canEditSong = false,
  theme,
  fontId,
}: ChordChartProps) {
  const [idx, setIdx] = useState(startIndex);
  // Fallback, falls songs durch Bearbeiten/Reload schrumpft und idx nicht mehr passt
  // (App rendert den Chart nur bei songs.length > 0, also ist songs[last] immer gültig).
  const song = songs[idx] ?? songs[songs.length - 1];

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => localStorage.getItem(`worship_key_${song.id}`) || null,
  );
  const [capo, setCapo] = useState(() => parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
  // Schriftgröße, Spalten und Ansicht werden je Lied gespeichert
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10));
  const [cols, setCols] = useState(() => parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10));
  const [lyricsOnly, setLyricsOnly] = useState(() => localStorage.getItem(`worship_lyrics_${song.id}`) === '1');
  // Fester Leerraum (in ch) für Taktstriche „[|]". Feinere Abstände macht man über
  // Leerzeichen direkt im ChordPro-Text (kein eigenes Bedienelement mehr).
  const chordGap = 2;

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Editor + Versionswahl (bearbeitete Version vs. Original)
  const [showEditor, setShowEditor] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  // Anzeige-Quelle pro Lied: 'chords' oder die fileId eines Dokuments (aus Speicher initialisieren)
  const [viewSource, setViewSource] = useState<'chords' | number>(() => {
    const saved = localStorage.getItem(`worship_view_${song.id}`);
    const id = saved ? Number(saved) : NaN;
    return saved && !Number.isNaN(id) && song.documents.some((d) => d.fileId === id) ? id : 'chords';
  });

  const [drawMode, setDrawMode] = useState(false);
  // Standardfarbe = adaptives Schwarz/Weiß (Creme im Dunkelmodus), passend zur Palette.
  const [drawColor, setDrawColor] = useState(() => (theme === 'dark' ? '#FFFCF2' : '#14110F'));
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [textSize, setTextSize] = useState(20);
  const [docClearSignal, setDocClearSignal] = useState(0); // löst Löschen im Dokument-Viewer aus
  const [docAdjust, setDocAdjust] = useState(false); // Anpassen-Modus (Zoom/Verschieben) im Dokument

  const textInputRef = useRef<HTMLInputElement | null>(null);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number>(0);
  const touchT = useRef<number>(0);
  const pendingLastPage = useRef(false);
  const slideDir = useRef<'right' | 'left'>('right'); // Richtung des Liedwechsel-Übergangs

  // ── abgeleitete Werte ──
  const curKey = selectedKey || song.targetKey;
  const totalOffset = getSemitoneOffset(song.originalKey, curKey);
  const gripOffset = totalOffset - capo; // Griff-Akkorde (mit Kapo)
  const shapeKey = shiftKey(curKey, -capo);
  const hasEdited = song.chordproEdited !== null;
  const displayedChordpro =
    !showOriginal && song.chordproEdited ? song.chordproEdited : song.chordpro;
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
    // bei Wechsel Dokument↔Akkorde neu vermessen (der Body wird dabei neu eingehängt)
    const el = drawing.bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setPageWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setPageWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSource]);

  // Spaltenbreite so, dass genau `cols` Spalten in die padded Content-Box passen.
  const colWidthPx =
    pageWidth > 0
      ? Math.floor((pageWidth - 2 * CONTENT_PAD - (cols - 1) * COLUMN_GAP) / cols)
      : undefined;

  // Geometrie fürs Blättern: eine Spalte = Breite + Lücke; eine Seite = cols Spalten.
  // Beim Blättern wird um den echten Spalten-Takt gescrollt (NICHT um die Bildschirmbreite),
  // sonst verschiebt sich jede Folgeseite, weil es das Innenpadding nur einmal links gibt.
  const columnStep = colWidthPx ? colWidthPx + COLUMN_GAP : 0;
  const endRef = useRef<HTMLDivElement | null>(null);
  const paged = usePagedColumns(
    drawing.bodyRef,
    drawing.contentRef,
    endRef,
    { pageStep: cols * columnStep, columnStep, pad: CONTENT_PAD, cols },
    [song.id, fontSize, cols, lyricsOnly, fontId, pageWidth, chordGap],
  );

  // ── Persistenz pro Song: beim Liedwechsel die gespeicherten Werte laden ──
  useEffect(() => {
    setSelectedKey(localStorage.getItem(`worship_key_${song.id}`) || null);
    setCapo(parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
    setFontSize(parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10));
    setCols(parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10));
    setLyricsOnly(localStorage.getItem(`worship_lyrics_${song.id}`) === '1');
    setShowOriginal(false); // beim Liedwechsel wieder die bevorzugte Version zeigen
    // gespeicherte Anzeige-Quelle laden (nur, wenn das Dokument noch existiert)
    const savedView = localStorage.getItem(`worship_view_${song.id}`);
    const savedId = savedView ? Number(savedView) : NaN;
    if (savedView && !Number.isNaN(savedId) && song.documents.some((d) => d.fileId === savedId)) {
      setViewSource(savedId);
    } else {
      setViewSource('chords');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, song.id]);

  // Speichern NUR bei echter Wertänderung (song.id bewusst NICHT in den Deps –
  // sonst überschreibt der Effekt beim Liedwechsel den gerade geladenen Wert).
  useEffect(() => {
    localStorage.setItem(`worship_view_${song.id}`, String(viewSource));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSource]);

  const activeDoc: SongDocument | null =
    viewSource === 'chords' ? null : (song.documents.find((d) => d.fileId === viewSource) ?? null);

  // Anpassen-Modus zurücksetzen, wenn Lied oder Anzeige-Quelle wechselt
  useEffect(() => {
    setDocAdjust(false);
  }, [viewSource, song.id]);

  useEffect(() => {
    localStorage.setItem(`worship_fs_${song.id}`, String(fontSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem(`worship_cols_${song.id}`, String(cols));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);
  useEffect(() => {
    localStorage.setItem(`worship_lyrics_${song.id}`, lyricsOnly ? '1' : '0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricsOnly]);
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
  }, [idx, song.id, pageWidth, fontSize, cols, lyricsOnly, chordGap]);

  useEffect(() => {
    if (selectedKey) localStorage.setItem(`worship_key_${song.id}`, selectedKey);
    else localStorage.removeItem(`worship_key_${song.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  useEffect(() => {
    localStorage.setItem(`worship_capo_${song.id}`, String(capo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capo]);

  // ── Einheitliche Navigation: erst durch die Seiten, dann zum nächsten/vorigen Lied ──
  const atStart = idx === 0 && (activeDoc !== null || paged.page === 0);
  const atEnd = idx === songs.length - 1 && (activeDoc !== null || paged.page >= paged.pageCount - 1);

  function next() {
    if (!activeDoc && paged.page < paged.pageCount - 1) {
      paged.goToPage(paged.page + 1); // innerhalb des Lieds: schneller Seitenwechsel
      return;
    }
    if (idx < songs.length - 1) {
      drawing.saveDrawing(song.id);
      slideDir.current = 'right';
      setIdx(idx + 1);
    }
  }
  function prev() {
    if (!activeDoc && paged.page > 0) {
      paged.goToPage(paged.page - 1);
      return;
    }
    if (idx > 0) {
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

  // Wischen verhält sich exakt wie das Tippen an den Rand: es ruft next()/prev() auf
  // (Seitenwechsel sofort, Liedwechsel mit Gleit-Animation). Kein natives Schwung-Scrollen
  // mehr – das Horizontal-Pannen ist per touch-action: pan-y unterbunden.
  function onTouchStart(e: React.TouchEvent) {
    if (drawMode) return;
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
    touchT.current = e.timeStamp;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = touchX.current - e.changedTouches[0].clientX;
    const dy = touchY.current - e.changedTouches[0].clientY;
    const dt = Math.max(1, e.timeStamp - touchT.current);
    touchX.current = null;
    if (Math.abs(dx) <= Math.abs(dy) * 1.2) return; // vertikal -> ignorieren
    const velocity = Math.abs(dx) / dt; // px pro ms
    // klares Wischen ODER kurzes schnelles Wischen löst aus
    if (Math.abs(dx) > 40 || (Math.abs(dx) > 14 && velocity > 0.4)) {
      if (dx > 0) next();
      else prev();
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
    if (activeDoc) setDocClearSignal((n) => n + 1);
    else drawing.clearAll();
    setConfirmClear(false);
  }

  // ── Editor: bearbeitete Version speichern / zurücksetzen ──
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
  // Aktuell ausgewählte Text-Anmerkung (für die Werkzeugleiste: Farbe/Größe live ändern)
  const selectedText = drawing.textObjects.find((o) => o.id === drawing.selectedTextId) ?? null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {/* Header */}
        <div className={styles.hdr}>
          <button className={styles.ibtn} onClick={goBack} aria-label="Zurück">
            <Icon name="chev-left" size={22} stroke={2.4} />
          </button>
          <div className={styles.center}>
            <button className={styles.titleBtn} onClick={() => setShowSongMenu((v) => !v)}>
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.titleChevron}>▾</span>
            </button>
            <div className={styles.keyRow}>
              {activeDoc ? (
                <span className={styles.modeHint}>{activeDoc.type === 'pdf' ? 'PDF' : 'Bild'}</span>
              ) : (
                <>
                  {!lyricsOnly && <span className={styles.keyChip}>{curKey}</span>}
                  {!lyricsOnly && capo > 0 && <span className={styles.capoBadge}>Capo {capo}</span>}
                  {lyricsOnly && <span className={styles.modeHint}>Nur Text</span>}
                  {hasEdited && (
                    <span className={styles.editedChip}>{showOriginal ? 'Original' : 'Bearbeitet'}</span>
                  )}
                  {song.bpm !== null && <span className={styles.bpmChip}>♩ {song.bpm}</span>}
                </>
              )}
            </div>
          </div>
          <div className={styles.right}>
            {!activeDoc && (
              <button
                className={`${styles.toolBtn}${showAppearance ? ' ' + styles.on : ''}`}
                onClick={() => setShowAppearance((v) => !v)}
                title="Aussehen"
              >
                Aa
              </button>
            )}
            {activeDoc && (
              <button
                className={`${styles.toolBtn}${docAdjust ? ' ' + styles.on : ''}`}
                onClick={() => {
                  setDocAdjust((a) => {
                    if (!a) setDrawMode(false);
                    return !a;
                  });
                }}
                title={docAdjust ? 'Fertig' : 'Anpassen (Zoom)'}
              >
                {docAdjust ? <Icon name="check" size={18} stroke={2.4} /> : <Icon name="search" size={18} stroke={2} />}
              </button>
            )}
            {onReload && (
              <button className={styles.toolBtn} onClick={onReload} disabled={reloading} title="Aktualisieren">
                <span className={reloading ? styles.spin : undefined}>↻</span>
              </button>
            )}
            <button
              className={`${styles.toolBtn}${drawMode ? ' ' + styles.on : ''}`}
              onClick={() =>
                setDrawMode((d) => {
                  if (!d) setDocAdjust(false);
                  return !d;
                })
              }
              title="Anmerkungen"
            >
              <Icon name="pencil" size={18} stroke={2.2} />
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

              {/* Sperr-Schicht: liegt halbtransparent über der Steuerung, wenn Anmerkungen da sind */}
              {drawing.hasAnnotations && (
                <div className={styles.lockOverlay}>
                  <div className={styles.lockOverlayText}>
                    🔒 Gesperrt
                    <span>Erst Anmerkungen löschen</span>
                  </div>
                </div>
              )}
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
              {canEditSong && (
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
              )}

              <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                Anzeige
              </div>
              <button
                className={`${styles.mmItem}${viewSource === 'chords' && !lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  setViewSource('chords');
                  setLyricsOnly(false);
                  setShowSongMenu(false);
                }}
              >
                <span>Akkorde &amp; Text</span>
                {viewSource === 'chords' && !lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              <button
                className={`${styles.mmItem}${viewSource === 'chords' && lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  setViewSource('chords');
                  setLyricsOnly(true);
                  setShowSongMenu(false);
                }}
              >
                <span>Nur Text</span>
                {viewSource === 'chords' && lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              {song.documents.map((d) => (
                <button
                  key={d.fileId}
                  className={`${styles.mmItem}${viewSource === d.fileId ? ' ' + styles.on : ''}`}
                  onClick={() => {
                    setViewSource(d.fileId);
                    setShowSongMenu(false);
                  }}
                >
                  <span>
                    {d.type === 'pdf' ? '📄' : '🖼️'} {d.name}
                  </span>
                  {viewSource === d.fileId && <span className={styles.mmCheck}>✓</span>}
                </button>
              ))}

              {viewSource === 'chords' && hasEdited && (
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
                      Bearbeitet
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

        {/* Chart-Bereich (fester Viewport) */}
        <div className={styles.chartArea}>
          {activeDoc ? (
            <DocumentView
              songId={song.id}
              doc={activeDoc}
              drawMode={drawMode}
              drawColor={drawColor}
              drawTool={drawTool}
              clearSignal={docClearSignal}
              adjust={docAdjust}
              onAdjustChange={setDocAdjust}
              onPrev={prev}
              onNext={next}
            />
          ) : (
            <>
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
                {canEditSong && (
                  <button
                    className={styles.createBtn}
                    onClick={() => {
                      setEditorError(null);
                      setShowEditor(true);
                    }}
                  >
                    Akkord-Datei erstellen
                  </button>
                )}
              </div>
            ) : (
              sections.map((sec, i) => (
                <Section
                  key={i}
                  section={sec}
                  semitones={gripOffset}
                  fontSize={fontSize}
                  lyricsOnly={lyricsOnly}
                  chordGap={chordGap}
                />
              ))
            )}
            {/* Unsichtbarer End-Marker: verrät per Layout-Position, in welcher Spalte der
                Inhalt endet → zuverlässige Seitenzählung (unabhängig von WebKits scrollWidth). */}
            <div ref={endRef} className={styles.endMarker} aria-hidden="true" />
          </div>
          {/* Platzhalter erzwingt die korrekte scrollbare Breite, damit jede Seite erreichbar
              ist (WebKit meldet die Multicol-Breite sonst zu klein). */}
          {paged.contentWidth > 0 && (
            <div className={styles.pageSpacer} style={{ left: paged.contentWidth }} aria-hidden="true" />
          )}
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
                outline: obj.id === drawing.selectedTextId ? '2px dashed var(--blue)' : undefined,
                outlineOffset: 4,
              }}
              onPointerDown={drawMode ? (e) => drawing.startDragText(e, obj) : undefined}
              onPointerMove={drawMode ? (e) => drawing.moveDragText(e, obj.id) : undefined}
              onPointerUp={drawMode ? drawing.endDragText : undefined}
            >
              {obj.text}
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
            </>
          )}
        </div>

        {/* Zeichen-Werkzeugleiste */}
        {drawMode && (
          <DrawToolbar
            colors={drawColors}
            drawColor={drawColor}
            setDrawColor={setDrawColor}
            drawTool={drawTool}
            setDrawTool={(t) => {
              drawing.clearTextSelection();
              setDrawTool(t);
            }}
            textSize={textSize}
            setTextSize={setTextSize}
            onClear={() => setConfirmClear(true)}
            isTextSelected={drawing.selectedTextId !== null}
            selectedColor={selectedText?.color}
            selectedSize={selectedText?.size}
            onSelectedColor={(c) => {
              if (drawing.selectedTextId !== null) drawing.setTextColor(drawing.selectedTextId, c);
            }}
            onSelectedResize={(d) => {
              if (drawing.selectedTextId !== null) drawing.resizeText(drawing.selectedTextId, d);
            }}
            onUndo={drawing.undo}
            canUndo={drawing.canUndo}
            onRedo={drawing.redo}
            canRedo={drawing.canRedo}
            onDeleteSelected={() => {
              if (drawing.selectedTextId !== null) drawing.deleteText(drawing.selectedTextId);
            }}
          />
        )}

        {/* Text-Eingabe-Overlay */}
        {drawing.pendingText && drawMode && (
          <div className={styles.textInputWrap} style={{ left: drawing.pendingText.cx, top: drawing.pendingText.cy }}>
            <input
              ref={textInputRef}
              type="text"
              autoFocus
              defaultValue={drawing.pendingText.initial ?? ''}
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

        {/* Text-Editor (Vollbild) */}
        {showEditor && (
          <ChordEditor
            songTitle={song.title}
            initialText={editorInitial}
            hasEdited={hasEdited}
            saving={editorSaving}
            error={editorError}
            onSave={handleSaveChordpro}
            onReset={handleResetChordpro}
            onClose={() => setShowEditor(false)}
          />
        )}

        {/* Footer */}
        <div className={styles.ftr}>
          <button className={styles.navBtn} onClick={prev} disabled={atStart} aria-label="Zurück / vorige Seite">
            <Icon name="chev-left" size={22} stroke={2.4} />
          </button>
          <div className={styles.ftrCenter}>
            {songs.length > 1 && (
              <div className={styles.dots}>
                {songs.map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.dot}${i === idx ? ' ' + styles.on : ''}`}
                    onClick={() => goToSong(i)}
                  />
                ))}
              </div>
            )}
            {nextSong ? (
              <div className={styles.ftrInfo}>
                <span className={styles.ftrNext}>Nächstes Lied: {nextSong.title}</span>
              </div>
            ) : songs.length > 1 ? (
              <div className={styles.ftrInfo}>
                <span className={styles.ftrSong}>Letztes Lied</span>
              </div>
            ) : null}
          </div>
          <button className={styles.navBtn} onClick={next} disabled={atEnd} aria-label="Weiter / nächste Seite">
            <Icon name="chev-right" size={22} stroke={2.4} />
          </button>
        </div>
      </>
    </Screen>
  );
}
