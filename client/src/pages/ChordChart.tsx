import { useEffect, useMemo, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { SectionTransposeSheet } from '../components/SectionTransposeSheet';
import { DrawToolbar } from '../components/DrawToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { DocumentView } from '../components/DocumentView';
import { StreamView } from '../components/StreamView';
import { Icon } from '../components/icons';
import { saveChordpro, deleteChordpro } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { parseChordPro } from '../utils/chordpro';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { generateChordPdf, generateSetlistPdfWithOwners } from '../utils/chordPdf';
import { sharePdf } from '../utils/sharePdf';
import type { DrawTool, Theme } from '../types/index';
import styles from './ChordChart.module.scss';

// Einstellungen pro Lied (Tonart, Kapo, Abschnitts-Transponierung, Schrift, Spalten, Anzeige).
interface SongSettings {
  key: string | null; // null = Standard (targetKey)
  capo: number;
  cols: 1 | 2;
  fontSize: number;
  lyricsOnly: boolean;
  secShift: Record<number, number>;
  showOriginal: boolean; // Original statt bearbeiteter Version (nur Sitzung)
  viewSource: 'chords' | number; // 'chords' oder fileId eines hochgeladenen Dokuments
}

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

function loadSettings(song: SetlistSong): SongSettings {
  const savedView = localStorage.getItem(`worship_view_${song.id}`);
  const savedId = savedView ? Number(savedView) : NaN;
  const viewSource =
    savedView && !Number.isNaN(savedId) && song.documents.some((d) => d.fileId === savedId) ? savedId : 'chords';
  return {
    key: localStorage.getItem(`worship_key_${song.id}`) || null,
    capo: parseInt(localStorage.getItem(`worship_capo_${song.id}`) || '0', 10),
    cols: parseInt(localStorage.getItem(`worship_cols_${song.id}`) || '1', 10) === 2 ? 2 : 1,
    fontSize: parseInt(localStorage.getItem(`worship_fs_${song.id}`) || '20', 10),
    lyricsOnly: localStorage.getItem(`worship_lyrics_${song.id}`) === '1',
    secShift: loadSecShift(song.id),
    showOriginal: false,
    viewSource,
  };
}

const DEFAULT_SETTINGS: SongSettings = {
  key: null,
  capo: 0,
  cols: 1,
  fontSize: 20,
  lyricsOnly: false,
  secShift: {},
  showOriginal: false,
  viewSource: 'chords',
};

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

/**
 * Lied-Anzeige als durchgehender PDF-Seitenstrom über den ganzen Ablauf.
 * Hochformat: 1 Seite. Querformat: 2 Seiten nebeneinander (auch über Liedgrenzen).
 * Die angetippte Hälfte ist „aktiv" und bestimmt, worauf Kopfzeile/Menüs wirken.
 */
export function ChordChart({
  songs,
  startIndex,
  onBack,
  onReload,
  reloading,
  canEditSong = false,
}: ChordChartProps) {
  // Einstellungen aller Lieder (für den durchgehenden Strom). Aus localStorage initialisiert.
  const [settings, setSettings] = useState<Record<number, SongSettings>>(() =>
    Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])),
  );
  const songIds = songs.map((s) => s.id).join(',');
  // Signatur über den INHALT (auch bearbeitete Version) → der Strom wird neu erzeugt, sobald sich
  // ein Lied-Text ändert (z. B. nach dem Bearbeiten), nicht nur wenn sich die Lied-Liste ändert.
  const songsSig = songs
    .map((s) => `${s.id}:${s.chordpro?.length ?? 0}:${s.chordproEdited?.length ?? 0}`)
    .join(',');
  useEffect(() => {
    setSettings(Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songIds]);

  function updateSetting(songId: number, patch: Partial<SongSettings>) {
    setSettings((prev) => {
      const cur = prev[songId] ?? DEFAULT_SETTINGS;
      const next = { ...cur, ...patch };
      if ('key' in patch) {
        if (next.key) localStorage.setItem(`worship_key_${songId}`, next.key);
        else localStorage.removeItem(`worship_key_${songId}`);
      }
      if ('capo' in patch) localStorage.setItem(`worship_capo_${songId}`, String(next.capo));
      if ('cols' in patch) localStorage.setItem(`worship_cols_${songId}`, String(next.cols));
      if ('fontSize' in patch) localStorage.setItem(`worship_fs_${songId}`, String(next.fontSize));
      if ('lyricsOnly' in patch) localStorage.setItem(`worship_lyrics_${songId}`, next.lyricsOnly ? '1' : '0');
      if ('viewSource' in patch) localStorage.setItem(`worship_view_${songId}`, String(next.viewSource));
      if ('secShift' in patch) {
        const k = `worship_secshift_${songId}`;
        if (Object.keys(next.secShift).length) localStorage.setItem(k, JSON.stringify(next.secShift));
        else localStorage.removeItem(k);
      }
      return { ...prev, [songId]: next };
    });
  }

  // Seiten-Position im Strom: linke (erste) sichtbare Seite + aktive Seite (angetippte Hälfte).
  const [streamPage, setStreamPage] = useState(0);
  const [activePage, setActivePage] = useState(0);

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showSecTranspose, setShowSecTranspose] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelEdited, setConfirmDelEdited] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  // Anmerkungs-Farben fest Schwarz/Rot/Gelb (wir arbeiten nur noch auf weißen PDF-Seiten → kein
  // Weiß, kein Dunkelmodus-Wechsel). Plus der freie Farbwähler in der Leiste.
  const [drawColor, setDrawColor] = useState('#14110F');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [docClearSignal, setDocClearSignal] = useState(0);
  const [docAdjust, setDocAdjust] = useState(false); // nur für Einzel-Dokument-Ansicht

  // App-Logo für die PDF-Kopfzeile (oben rechts) einmalig vorladen.
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = '/logo.png';
  }, []);

  const drawColors = ['#14110F', '#DD0000', '#FFCE00'];

  // ── Durchgehender Seitenstrom: alle Lieder zu EINER PDF (mit Seiten-Besitzer) ──
  const stream = useMemo(() => {
    if (songs.length === 0) return null;
    const songsForPdf = songs.map((s) => {
      const st = settings[s.id] ?? loadSettings(s);
      const chordpro = !st.showOriginal && s.chordproEdited ? s.chordproEdited : s.chordpro;
      return { ...s, chordpro };
    });
    const { doc, owners } = generateSetlistPdfWithOwners(songsForPdf, (s) => {
      const st = settings[s.id] ?? loadSettings(s);
      const off = getSemitoneOffset(s.originalKey, st.key || s.targetKey) - st.capo;
      return {
        semitones: off,
        cols: st.cols,
        fontPt: Math.max(8, Math.round(st.fontSize * 0.6)),
        lyricsOnly: st.lyricsOnly,
        sectionSemitones: st.secShift,
        displayKey: st.key || s.targetKey,
        logo: logoImg,
      };
    });
    return { data: doc.output('arraybuffer') as ArrayBuffer, owners };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig, settings, logoImg]);

  // Ausrichtung (für die Navigations-Grenze: im Querformat nie eine Seite allein lassen).
  const [landscape, setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  useEffect(() => {
    const f = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);

  const owners = stream?.owners ?? [];
  const lastPage = Math.max(0, owners.length - 1);
  // Max. linke Seite: im 2-up stoppt die Navigation eine Seite früher (Paar bleibt voll).
  const maxLeft = landscape && owners.length > 1 ? owners.length - 2 : lastPage;
  const pageIdx = Math.min(streamPage, lastPage);
  const activeIdx = Math.min(activePage, lastPage);
  const activeSongIdx = owners[activeIdx]?.songIdx ?? 0;
  const song = songs[activeSongIdx] ?? songs[songs.length - 1];
  const set = settings[song.id] ?? DEFAULT_SETTINGS;

  // Beim Start auf das gewünschte Lied springen (sobald der Strom bereit ist).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || owners.length === 0) return;
    didInit.current = true;
    const p = owners.findIndex((o) => o.songIdx === startIndex);
    if (p > 0) {
      setStreamPage(p);
      setActivePage(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners.length]);

  // ── abgeleitete Werte des AKTIVEN Lieds ──
  const curKey = set.key || song.targetKey;
  const totalOffset = getSemitoneOffset(song.originalKey, curKey);
  const shapeKey = shiftKey(curKey, -set.capo);
  const hasEdited = song.chordproEdited !== null;
  const displayedChordpro = !set.showOriginal && song.chordproEdited ? song.chordproEdited : song.chordpro;
  const sections = parseChordPro(displayedChordpro);
  const editorInitial =
    displayedChordpro ||
    `{title: ${song.title}}\n{key: ${song.targetKey || song.originalKey || 'C'}}\n\n{comment: Vers 1}\n[${song.targetKey || 'C'}]Hier Text mit Akkorden eingeben\n\n{comment: Chorus}\n`;

  const activeDoc = set.viewSource === 'chords' ? null : song.documents.find((d) => d.fileId === set.viewSource) ?? null;

  useEffect(() => {
    setDocAdjust(false);
  }, [set.viewSource, song.id]);

  // ── Navigation im Strom (Wischen/Footer): immer um 1 Seite; aktive = neue linke Seite ──
  function go(delta: number) {
    const next = Math.min(Math.max(0, pageIdx + delta), maxLeft);
    setStreamPage(next);
    setActivePage(next);
  }
  function next() {
    go(1);
  }
  function prev() {
    go(-1);
  }
  function goToSong(target: number) {
    const p = owners.findIndex((o) => o.songIdx === target);
    if (p >= 0) {
      setStreamPage(Math.min(p, maxLeft));
      setActivePage(p);
    }
  }
  const atStart = pageIdx <= 0;
  const atEnd = pageIdx >= maxLeft;

  // Tastatur ←/→
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
    setDocClearSignal((n) => n + 1);
    setConfirmClear(false);
  }

  async function handleSaveChordpro(text: string) {
    setEditorSaving(true);
    setEditorError(null);
    try {
      await saveChordpro(song.id, song.arrangementId, text);
      setShowEditor(false);
      updateSetting(song.id, { showOriginal: false });
      onReload?.();
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
      updateSetting(song.id, { showOriginal: false });
      onReload?.();
    } catch (e) {
      setEditorError(e instanceof ApiError ? e.message : 'Zurücksetzen fehlgeschlagen.');
    } finally {
      setEditorSaving(false);
    }
  }

  const nextSong = activeSongIdx < songs.length - 1 ? songs[activeSongIdx + 1] : null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {/* Header */}
        <div className={styles.hdr}>
          <button className={styles.ibtn} onClick={onBack} aria-label="Zurück">
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
                  {!set.lyricsOnly && <span className={styles.keyChip}>{curKey}</span>}
                  {!set.lyricsOnly && set.capo > 0 && <span className={styles.capoBadge}>Capo {set.capo}</span>}
                  {set.lyricsOnly && <span className={styles.modeHint}>Nur Text</span>}
                  {hasEdited && <span className={styles.editedChip}>{set.showOriginal ? 'Original' : 'Bearbeitet'}</span>}
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
                onClick={() =>
                  setDocAdjust((a) => {
                    if (!a) setDrawMode(false);
                    return !a;
                  })
                }
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

        {/* Aussehen-Dropdown (pro aktivem Lied: Schriftgröße, Spalten) */}
        {showAppearance && (
          <>
            <div className={styles.scrim} onClick={() => setShowAppearance(false)} />
            <div className={styles.appMenu}>
              <div className={styles.menuLbl}>Schriftgröße</div>
              <div className={styles.appRow}>
                <button
                  className={styles.stepBtn}
                  onClick={() => updateSetting(song.id, { fontSize: Math.max(12, set.fontSize - 2) })}
                >
                  A−
                </button>
                <span className={styles.stepValue}>{set.fontSize}</span>
                <button
                  className={styles.stepBtn}
                  onClick={() => updateSetting(song.id, { fontSize: Math.min(40, set.fontSize + 2) })}
                >
                  A+
                </button>
              </div>

              <div className={styles.menuLbl}>Spalten</div>
              <div className={styles.segGroup}>
                <button
                  className={`${styles.segBtn}${set.cols === 1 ? ' ' + styles.on : ''}`}
                  onClick={() => updateSetting(song.id, { cols: 1 })}
                >
                  1 Spalte
                </button>
                <button
                  className={`${styles.segBtn}${set.cols === 2 ? ' ' + styles.on : ''}`}
                  onClick={() => updateSetting(song.id, { cols: 2 })}
                >
                  2 Spalten
                </button>
              </div>
            </div>
          </>
        )}

        {/* Lied-Menü (über den Titel) */}
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
                {set.capo > 0 ? (
                  <span className={styles.mmValueActive}>Bund {set.capo}</span>
                ) : (
                  <span className={styles.mmValue}>–</span>
                )}
              </button>
              {set.viewSource === 'chords' && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSecTranspose(true);
                    setShowSongMenu(false);
                  }}
                >
                  <span>Abschnitte transponieren</span>
                  {Object.keys(set.secShift).length > 0 ? (
                    <span className={styles.mmValueActive}>{Object.keys(set.secShift).length} aktiv</span>
                  ) : (
                    <span className={styles.mmValue}>–</span>
                  )}
                </button>
              )}
              {set.viewSource === 'chords' && sections.length > 0 && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSongMenu(false);
                    const doc = generateChordPdf(
                      { ...song, chordpro: displayedChordpro },
                      {
                        semitones: totalOffset,
                        cols: set.cols,
                        fontPt: Math.max(8, Math.round(set.fontSize * 0.6)),
                        lyricsOnly: set.lyricsOnly,
                        sectionSemitones: set.secShift,
                        displayKey: curKey,
                        logo: logoImg,
                      },
                    );
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
                className={`${styles.mmItem}${set.viewSource === 'chords' && !set.lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  updateSetting(song.id, { viewSource: 'chords', lyricsOnly: false });
                  setShowSongMenu(false);
                }}
              >
                <span>Akkorde &amp; Text</span>
                {set.viewSource === 'chords' && !set.lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              <button
                className={`${styles.mmItem}${set.viewSource === 'chords' && set.lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  updateSetting(song.id, { viewSource: 'chords', lyricsOnly: true });
                  setShowSongMenu(false);
                }}
              >
                <span>Nur Text</span>
                {set.viewSource === 'chords' && set.lyricsOnly && <span className={styles.mmCheck}>✓</span>}
              </button>
              {song.documents.map((d) => (
                <button
                  key={d.fileId}
                  className={`${styles.mmItem}${set.viewSource === d.fileId ? ' ' + styles.on : ''}`}
                  onClick={() => {
                    updateSetting(song.id, { viewSource: d.fileId });
                    setShowSongMenu(false);
                  }}
                >
                  <span>
                    {d.type === 'pdf' ? '📄' : '🖼️'} {d.name}
                  </span>
                  {set.viewSource === d.fileId && <span className={styles.mmCheck}>✓</span>}
                </button>
              ))}

              {set.viewSource === 'chords' && hasEdited && (
                <>
                  <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                    Version
                  </div>
                  <div className={styles.segGroup}>
                    <button
                      className={`${styles.segBtn}${!set.showOriginal ? ' ' + styles.on : ''}`}
                      onClick={() => {
                        updateSetting(song.id, { showOriginal: false });
                        setShowSongMenu(false);
                      }}
                    >
                      Bearbeitet
                    </button>
                    <button
                      className={`${styles.segBtn}${set.showOriginal ? ' ' + styles.on : ''}`}
                      onClick={() => {
                        updateSetting(song.id, { showOriginal: true });
                        setShowSongMenu(false);
                      }}
                    >
                      Original
                    </button>
                  </div>
                  {canEditSong && (
                    <button
                      className={styles.mmItem}
                      onClick={() => {
                        setShowSongMenu(false);
                        setConfirmDelEdited(true);
                      }}
                    >
                      <span className={styles.mmDanger}>Bearbeitete Version löschen</span>
                      <span className={styles.mmValue}>🗑</span>
                    </button>
                  )}
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
            isCustom={set.key !== null}
            onPick={(k) => {
              updateSetting(song.id, { key: k });
              setShowKeyPicker(false);
            }}
            onReset={() => {
              updateSetting(song.id, { key: null });
              setShowKeyPicker(false);
            }}
            onClose={() => setShowKeyPicker(false)}
          />
        )}

        {/* Kapo-Picker */}
        {showCapoPicker && (
          <CapoPicker
            capo={set.capo}
            shapeKey={shapeKey}
            soundingKey={curKey}
            onPick={(c) => {
              updateSetting(song.id, { capo: c });
              setShowCapoPicker(false);
            }}
            onClose={() => setShowCapoPicker(false)}
          />
        )}

        {showSecTranspose && (
          <SectionTransposeSheet
            sections={sections}
            value={set.secShift}
            onChange={(index, semitones) => {
              const nextShift = { ...set.secShift };
              if (semitones === 0) delete nextShift[index];
              else nextShift[index] = semitones;
              updateSetting(song.id, { secShift: nextShift });
            }}
            onReset={() => updateSetting(song.id, { secShift: {} })}
            onClose={() => setShowSecTranspose(false)}
          />
        )}

        {/* Anzeige-Bereich */}
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
          ) : stream && owners.length > 0 ? (
            <StreamView
              pdfData={stream.data}
              owners={owners}
              pageIndex={pageIdx}
              onPageIndex={(i) => {
                setStreamPage(i);
                setActivePage(i);
              }}
              activePage={activeIdx}
              onActivePage={setActivePage}
              drawMode={drawMode}
              drawColor={drawColor}
              setDrawColor={setDrawColor}
              drawTool={drawTool}
              setDrawTool={setDrawTool}
              drawColors={drawColors}
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

        {/* Zeichen-Werkzeugleiste (nur für hochgeladene Einzeldokumente; der Strom bringt seine eigene mit) */}
        {drawMode && activeDoc && (
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

        {confirmClear && activeDoc && (
          <ConfirmDialog
            title="Markierungen löschen?"
            message={`Alle Zeichnungen auf der aktiven Seite werden entfernt. Das kann nicht rückgängig gemacht werden.`}
            confirmLabel="Löschen"
            onConfirm={clearDrawing}
            onCancel={() => setConfirmClear(false)}
          />
        )}

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

        {confirmDelEdited && (
          <ConfirmDialog
            title="Bearbeitete Version löschen?"
            message={`Die bearbeitete Version von „${song.title}" wird aus ChurchTools entfernt. Das Original bleibt erhalten.`}
            confirmLabel={editorSaving ? 'Löschen…' : 'Löschen'}
            onConfirm={() => {
              setConfirmDelEdited(false);
              void handleResetChordpro();
            }}
            onCancel={() => setConfirmDelEdited(false)}
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
                    className={`${styles.dot}${i === activeSongIdx ? ' ' + styles.on : ''}`}
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
