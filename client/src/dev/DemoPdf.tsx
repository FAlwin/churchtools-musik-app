import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SetlistSong } from '@shared/types/index';
import { generateChordPdf } from '../utils/chordPdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * NUR Entwicklung (?demo=pdf): erzeugt aus einem Mock-Lied eine PDF und rendert sie via pdfjs
 * auf Canvas (screenshot-bar), um die ChordPro→PDF-Qualität zu prüfen.
 */

const DEMO_CHORDPRO = `{title: Großer Gott wir loben dich}
{key: G}

{comment: Vers 1}
[G]Großer Gott, wir [D]loben dich,
[Em]Herr, wir [C]preisen deine [G]Stärke.
[G]Vor dir neigt die [D]Erde sich
[Em]und bewundert [C]deine [G]Werke.
[C]Wie du warst vor [G]aller Zeit,
[D]so bleibst du in [G]Ewigkeit.

{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.
[C]Halleluja, [G]lobt den Herrn,
[D]der uns treu er[G]hält.

{comment: Vers 2}
[G]Alles, was dich [D]preisen kann,
[Em]Cherubim und [C]Serafi[G]nen,
[G]stimmen dir ein [D]Loblied an,
[Em]alle Engel, [C]die dir [G]dienen.

{comment: Bridge}
[Am]Herr, erbarme [C]dich,
[G]führe uns zu [D]dir.`;

const SONG: SetlistSong = {
  id: 999001,
  arrangementId: 999001,
  title: 'Großer Gott wir loben dich',
  author: 'Demo',
  originalKey: 'G',
  targetKey: 'G',
  bpm: 72,
  timeSig: '4/4',
  ccli: null,
  chordpro: DEMO_CHORDPRO,
  chordproEdited: null,
  documents: [],
};

export function DemoPdf() {
  const [cols, setCols] = useState<1 | 2>(1);
  const [fontPt, setFontPt] = useState(11);
  const [semitones, setSemitones] = useState(0);
  const [lyricsOnly, setLyricsOnly] = useState(false);
  const [pages, setPages] = useState(0);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = generateChordPdf(SONG, { cols, fontPt, semitones, lyricsOnly });
      const data = doc.output('arraybuffer');
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      if (cancelled || !host.current) return;
      host.current.innerHTML = '';
      setPages(pdf.numPages);
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.4 });
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        c.style.cssText = 'width:100%;max-width:600px;display:block;margin:10px auto;box-shadow:0 1px 6px rgba(0,0,0,.3);background:#fff';
        await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
        if (!cancelled) host.current?.appendChild(c);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cols, fontPt, semitones, lyricsOnly]);

  const btn = { padding: '6px 10px', marginRight: 6, cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', font: '14px sans-serif', background: '#888' }}>
      <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: '#eee' }}>
        <span>Spalten:</span>
        <button style={btn} onClick={() => setCols(1)} disabled={cols === 1}>1</button>
        <button style={btn} onClick={() => setCols(2)} disabled={cols === 2}>2</button>
        <span>Schrift:</span>
        <button style={btn} onClick={() => setFontPt((f) => Math.max(7, f - 1))}>A−</button>
        <span>{fontPt}pt</span>
        <button style={btn} onClick={() => setFontPt((f) => Math.min(20, f + 1))}>A+</button>
        <span>Transp.:</span>
        <button style={btn} onClick={() => setSemitones((s) => s - 1)}>−1</button>
        <span>{semitones}</span>
        <button style={btn} onClick={() => setSemitones((s) => s + 1)}>+1</button>
        <button style={btn} onClick={() => setLyricsOnly((v) => !v)}>{lyricsOnly ? 'mit Akkorden' : 'nur Text'}</button>
        <span>· {pages} Seite(n)</span>
      </div>
      <div ref={host} style={{ flex: 1, overflow: 'auto', padding: 10 }} />
    </div>
  );
}
