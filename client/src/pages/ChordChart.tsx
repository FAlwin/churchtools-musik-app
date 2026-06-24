import { useEffect, useMemo, useRef, useState } from 'react';
import type { SetlistSong, SongDocument } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { SectionTransposeSheet } from '../components/SectionTransposeSheet';
import { DrawToolbar } from '../components/DrawToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { DocumentView } from '../components/DocumentView';
import { Icon } from '../components/icons';
import { saveChordpro, deleteChordpro } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { parseChordPro } from '../utils/chordpro';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { generateChordPdf } from '../utils/chordPdf';
import { sharePdf } from '../utils/sharePdf';
import { DRAW_COLORS } from '../utils/constants';
import type { DrawTool, Theme } from '../types/index';
import styles from './ChordChart.module.scss';

// Abschnitts-Transponierung (Issue #16): Halbton-Versatz je Abschnitts-Index, pro Lied gespeichert.
function loadSecShift(songId: number): Record<number, number> {
  try {
    const raw = localStorage.getItem(`worship_secshift_${songId}`);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(k);
      if (Number.isInteger(n) && typeof v === 'number' && v !== 0) out[n] = v;
    }
    return out;
  } catch {
    return {};
  }
}

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
}: ChordChartProps) {
  const [idx, setIdx] = useState(startIndex);
  // Fallback, falls songs durch Bearbeiten/Reload schrumpft und idx nicht mehr passt
  // (App rendert den Chart nur bei songs.length > 0, also ist songs[last] immer gültig).
  const song = songs[idx] ?? songs[songs.length - 1];

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => localStorage.getItem(`worship_key_${song.id}`) || null,
  );
  const [capo, setCapo] = useState(() => parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
  // Abschnitts-Transponierung: Halbton-Versatz je Abschnitts-Index (Issue #16).
  const [secShift, setSecShift] = useState<Record<number, number>>(() => loadSecShift(song.id));
  // Schriftgröße, Spalten und Ansicht werden je Lied gespeichert
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10));
  const [cols, setCols] = useState(() => parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10));
  const [lyricsOnly, setLyricsOnly] = useState(() => localStorage.getItem(`worship_lyrics_${song.id}`) === '1');

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showSecTranspose, setShowSecTranspose] = useState(false);
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
  const [docClearSignal, setDocClearSignal] = useState(0); // löst Löschen im Viewer aus
  const [docAdjust, setDocAdjust] = useState(false); // Anpassen-Modus (Zoom/Verschieben)

  // App-Logo für die PDF-Kopfzeile (oben rechts, SongSelect-Stil) einmalig vorladen.
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = '/logo.png';
  }, []);

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
  // Schwarz im Dark Mode auf Creme umstellen, damit sichtbar
  const drawColors = DRAW_COLORS.map((c) => (c === '#14110F' ? (theme === 'dark' ? '#FFFCF2' : '#14110F') : c));

  // Akkord-Ansicht = in-app erzeugte PDF (PDF-Pivot). Wird neu erzeugt bei Inhalt/Tonart/Kapo/
  // Spalten/Schrift/„Nur Text"/Abschnitts-Transponierung. ChordPro bleibt die Quelle.
  const chordPdfData = useMemo(() => {
    if (viewSource !== 'chords' || sections.length === 0) return null;
    const fontPt = Math.max(8, Math.round(fontSize * 0.6));
    const docPdf = generateChordPdf(
      { ...song, chordpro: displayedChordpro },
      {
        semitones: gripOffset,
        cols: (cols === 2 ? 2 : 1) as 1 | 2,
        fontPt,
        lyricsOnly,
        sectionSemitones: secShift,
        displayKey: curKey,
        logo: logoImg,
      },
    );
    return docPdf.output('arraybuffer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSource, sections.length, song.id, displayedChordpro, gripOffset, cols, fontSize, lyricsOnly, secShift, curKey, logoImg]);

  // ── Persistenz pro Song: beim Liedwechsel die gespeicherten Werte laden ──
  useEffect(() => {
    setSelectedKey(localStorage.getItem(`worship_key_${song.id}`) || null);
    setCapo(parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10));
    setSecShift(loadSecShift(song.id));
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
  useEffect(() => {
    if (selectedKey) localStorage.setItem(`worship_key_${song.id}`, selectedKey);
    else localStorage.removeItem(`worship_key_${song.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  useEffect(() => {
    localStorage.setItem(`worship_capo_${song.id}`, String(capo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capo]);

  useEffect(() => {
    const key = `worship_secshift_${song.id}`;
    if (Object.keys(secShift).length > 0) localStorage.setItem(key, JSON.stringify(secShift));
    else localStorage.removeItem(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secShift]);

  // ── Navigation zwischen den Liedern (das Blättern innerhalb eines Lieds/Dokuments
  //    übernimmt der Viewer selbst und ruft an den Rändern next()/prev() auf). ──
  const atStart = idx === 0;
  const atEnd = idx === songs.length - 1;

  function next() {
    if (idx < songs.length - 1) setIdx(idx + 1);
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }
  function goToSong(target: number) {
    if (target !== idx) setIdx(target);
  }
  function goBack() {
    onBack();
  }

  // Tastatur: ←/→ blättern wie die Pfeil-Buttons (praktisch mit Tastatur/Fußschalter am iPad).
  // Ein Ref hält die aktuellen Handler, damit der Listener nur einmal registriert wird.
  const navRef = useRef({ next, prev, blocked: false });
  navRef.current = { next, prev, blocked: showEditor || drawMode };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (navRef.current.blocked) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navRef.current.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navRef.current.prev();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function clearDrawing() {
    setDocClearSignal((n) => n + 1); // löscht die Anmerkungen der aktuellen Seite im Viewer
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
              {viewSource === 'chords' && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSecTranspose(true);
                    setShowSongMenu(false);
                  }}
                >
                  <span>Abschnitte transponieren</span>
                  {Object.keys(secShift).length > 0 ? (
                    <span className={styles.mmValueActive}>
                      {Object.keys(secShift).length} aktiv
                    </span>
                  ) : (
                    <span className={styles.mmValue}>–</span>
                  )}
                </button>
              )}
              {viewSource === 'chords' && sections.length > 0 && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSongMenu(false);
                    const fontPt = Math.max(8, Math.round(fontSize * 0.6));
                    const doc = generateChordPdf(song, {
                      semitones: totalOffset,
                      cols: (cols === 2 ? 2 : 1) as 1 | 2,
                      fontPt,
                      lyricsOnly,
                      sectionSemitones: secShift,
                      displayKey: curKey,
                      logo: logoImg,
                    });
                    void sharePdf(doc, song.title);
                  }}
                >
                  <span>Als PDF teilen</span>
                  <span className={styles.mmValue}>⤴</span>
                </button>
              )}
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

        {showSecTranspose && (
          <SectionTransposeSheet
            sections={sections}
            value={secShift}
            onChange={(index, semitones) =>
              setSecShift((prev) => {
                const next = { ...prev };
                if (semitones === 0) delete next[index];
                else next[index] = semitones;
                return next;
              })
            }
            onReset={() => setSecShift({})}
            onClose={() => setShowSecTranspose(false)}
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
          ) : chordPdfData ? (
            <DocumentView
              key={`song${song.id}`}
              songId={song.id}
              pdfData={chordPdfData}
              storeId={`song${song.id}`}
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
          )}
        </div>

        {/* Zeichen-Werkzeugleiste (Freihand: Stift/Marker/Radierer + Löschen) */}
        {drawMode && (
          <DrawToolbar
            colors={drawColors}
            drawColor={drawColor}
            setDrawColor={setDrawColor}
            drawTool={drawTool}
            setDrawTool={setDrawTool}
            onClear={() => setConfirmClear(true)}
            allowText={false}
          />
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
