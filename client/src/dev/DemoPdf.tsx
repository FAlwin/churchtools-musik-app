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

// Bewusst lange Zeilen (nur am Zeilenanfang ein Akkord) zum Prüfen des Wort-Umbruchs in 1/2 Spalten.
const DEMO_CHORDPRO = `{title: Welch ein Freund ist unser Jesus}
{key: G}

{comment: Vers 1}
[G]Welch ein Freund ist unser Jesus, [C]o wie hoch ist er erhöht.
[G]Er hat uns mit Gott versöhnet [C]und vertritt uns im Gebet.
[D]Wer mag sagen und ermessen, [D7]wieviel [G]Heil verloren geht,
[C]wenn wir nicht zu ihm uns [G]wenden und ihn [D]suchen im Ge[G]bet.

{comment: Vers 2}
[G]Wenn des Feindes Macht uns drohet [C]und manch Sturm rings um uns weht,
[G]brauchen wir uns nicht zu fürchten, [C]stehn wir gläubig im Gebet.
[D]Da erweist sich Jesu Treue, [D7]der mit [G]uns durch alles geht,
[C]der die ganze Last uns [G]abnimmt, [D]wenn wir kommen ins Ge[G]bet.

{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.

{comment: Nur-Text-Test (Silbentrenner / Lücken / Einrückung)}
[E]Ich glaube an den Va -[F#m] ter den Schöpfer al -[B] ler Welt
   [E]Gott all -[A] mächtig
[E]Du stiegst ins Reich der To -[A] ten   standst auf in Herr -[B] lichkeit
[E]Und herrschst in E -[A] wigkeit

{comment: Lücken-Test (breite Akkorde über kurzen Silben)}
[A]   Ich glaube an den [C#m]Va - [B]ter den Schöpfer al - [E/G#]ler Welt
[C#m] An den Heiligen Geist der Wahrheit
[C#m]   Ich glaube an deinen [A]Namen [B]Jesus`;

const SONG: SetlistSong = {
  id: 999001,
  arrangementId: 999001,
  title: 'Welch ein Freund ist unser Jesus',
  author: 'Demo',
  originalKey: 'G',
  targetKey: 'G',
  bpm: 72,
  timeSig: '4/4',
  ccli: null,
  chordpro: DEMO_CHORDPRO,
  versions: [],
  documents: [],
};

export function DemoPdf() {
  const [cols, setCols] = useState<1 | 2>(1);
  const [fontPt, setFontPt] = useState(11);
  const [semitones, setSemitones] = useState(0);
  const [lyricsOnly, setLyricsOnly] = useState(false);
  const [pages, setPages] = useState(0);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = '/logo-tight.png';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = generateChordPdf(SONG, { cols, fontPt, semitones, lyricsOnly, logo });
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
  }, [cols, fontPt, semitones, lyricsOnly, logo]);

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
