/**
 * Entwicklungs-Harness für PageDeck (#113): mountet die Seiten-Engine mit künstlichen Seiten und
 * vorbereiteten Text-Anmerkungen und zeichnet JEDEN Browser-Frame auf (Overlay-Zustand, Streifen-
 * Transform, sichtbare Textobjekte mit Position). Damit lässt sich das Text-Aufblitzen beim
 * Blättern deterministisch nachweisen, ohne Server/Login. Wird NICHT mitgebaut (eigener
 * HTML-Einstieg harness.html, Vite baut nur index.html).
 */
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PageDeck } from './components/PageDeck';
import './styles/main.scss';

// ── Kunstseiten: weiß mit großer Seitennummer + Linien (eindeutig unterscheidbar) ──
function makePage(n: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 840;
  c.height = 1188;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = ['#dbe8ff', '#ffe8db', '#e2ffdb', '#f3dbff'][n % 4];
  ctx.fillRect(0, 0, c.width, 120);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 90px sans-serif';
  ctx.fillText(`SEITE ${n + 1}`, 60, 95);
  ctx.font = '28px sans-serif';
  for (let y = 220; y < 1100; y += 60)
    ctx.fillText(`Zeile ${(y - 160) / 60} auf Seite ${n + 1}`, 60, y);
  return c;
}

// Harness-Schlüssel matchen KEY_RE nicht → pushField synct NICHTS zum Server (rein lokal).
const KEY = (p: number) => `harness_p${p}`;

// Text-Anmerkungen vorbelegen: Seite 1 unten, Seite 2 oben – wie im echten Fall (#113).
function seed(): void {
  localStorage.setItem(
    `${KEY(0)}_text`,
    JSON.stringify([
      {
        id: 1,
        fx: 0.5,
        fy: 0.82,
        text: 'ALTE NOTIZ S1',
        color: '#c00000',
        sizeCqh: 3,
        bold: false,
        align: 'center',
      },
    ]),
  );
  localStorage.setItem(
    `${KEY(1)}_text`,
    JSON.stringify([
      {
        id: 2,
        fx: 0.5,
        fy: 0.3,
        text: 'NOTIZ S2',
        color: '#0060a1',
        sizeCqh: 3,
        bold: false,
        align: 'center',
      },
    ]),
  );
  localStorage.removeItem(`${KEY(2)}_text`);
  localStorage.removeItem(`${KEY(3)}_text`);
  // Ein einfacher Strich auf Seite 1+2 (zum Vergleich Striche vs. Text).
  const s = document.createElement('canvas');
  s.width = 840;
  s.height = 1188;
  const sctx = s.getContext('2d')!;
  sctx.strokeStyle = '#00a000';
  sctx.lineWidth = 8;
  sctx.beginPath();
  sctx.moveTo(100, 950);
  sctx.lineTo(700, 980);
  sctx.stroke();
  localStorage.setItem(KEY(0), s.toDataURL('image/png'));
  localStorage.setItem(KEY(1), s.toDataURL('image/png'));
}

// ── Frame-Rekorder: pro requestAnimationFrame den sichtbaren Text-Zustand festhalten ──
interface FrameRec {
  ts: number;
  overlay: boolean;
  strip: string | null;
  texts: { t: string; x: number; y: number; w: number; fs: string; inOverlay: boolean }[];
}
declare global {
  interface Window {
    __rec: FrameRec[];
    __startRec: () => void;
    __stopRec: () => void;
    __go: (delta: number) => void;
  }
}
window.__rec = [];
let recOn = false;
function tick(ts: number): void {
  const overlay = document.querySelector('[class*="slideOverlay"]');
  const panes = Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'));
  const strip = panes.length
    ? panes.map((p) => `${p.dataset.pane}:${getComputedStyle(p).transform}`).join(' | ')
    : null;
  const texts = Array.from(document.querySelectorAll('[class*="textObj"]')).map((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const cs = getComputedStyle(el as HTMLElement);
    return {
      t: (el.textContent ?? '').slice(0, 20),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      fs: cs.fontSize,
      inOverlay: !!el.closest('[class*="slideOverlay"]'),
    };
  });
  window.__rec.push({ ts: Math.round(ts), overlay: !!overlay, strip, texts });
  if (recOn) requestAnimationFrame(tick);
}
window.__startRec = () => {
  window.__rec = [];
  recOn = true;
  requestAnimationFrame(tick);
};
window.__stopRec = () => {
  recOn = false;
};

function Harness(): JSX.Element {
  const [pages] = useState(() => {
    seed();
    return [makePage(0), makePage(1), makePage(2), makePage(3)];
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [drawMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#c00000');
  const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser' | 'text'>('pen');

  window.__go = (delta: number) => {
    const t = Math.max(0, Math.min(pages.length - 1, pageIndex + delta));
    setPageIndex(t);
    setActivePage(t);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, display: 'flex', gap: 8, zIndex: 50, background: '#ddd' }}>
        <button id="btn-back" onClick={() => window.__go(-1)}>
          ← Zurück
        </button>
        <button id="btn-fwd" onClick={() => window.__go(1)}>
          Vor →
        </button>
        <span>
          Seite {pageIndex + 1} / {pages.length}
        </span>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <PageDeck
          pages={pages}
          loading={false}
          error={null}
          loadingLabel=""
          drawKeyFor={KEY}
          zoomKeyBaseFor={(p) => `harness_zoom_p${p}`}
          pageIndex={pageIndex}
          onPageIndex={setPageIndex}
          activePage={activePage}
          onActivePage={setActivePage}
          drawMode={drawMode}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawTool={drawTool}
          setDrawTool={setDrawTool}
          drawColors={['#c00000', '#0060a1', '#00a000']}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
