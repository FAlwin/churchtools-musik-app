/**
 * „Poof"-Zerfall (#161 Etappe B): Ein Snapshot-Canvas eines Elements wird in viele kleine Partikel
 * zerlegt, die auseinanderdriften, aufsteigen und verwehen (Apple-Nachricht-löschen-Look). Läuft
 * auf einem kurzlebigen Overlay-Canvas über dem Element und räumt sich selbst wieder ab.
 *
 * Bewusst begrenzt (Blockgröße, Partikelzahl, kurze Dauer), damit es auch auf älteren iPads flüssig
 * bleibt. `Math.random` ist hier unkritisch (reiner Optik-Effekt).
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

/** Zerstäubt `source` (Abbild des Elements) an der Bildschirm-Position `rect`. */
export function disintegrate(source: HTMLCanvasElement, rect: DOMRect): void {
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w <= 0 || h <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cv = document.createElement('canvas');
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.cssText =
    `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${w}px;height:${h}px;` +
    `pointer-events:none;z-index:60;`;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const sctx = source.getContext('2d');
  if (!ctx || !sctx) {
    cv.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  // Quell-Pixel EINMAL lesen (nicht pro Partikel – das wäre viel zu langsam).
  const img = sctx.getImageData(0, 0, source.width, source.height).data;
  const sx = source.width / w;
  const sy = source.height / h;
  const BLOCK = 6; // Partikelkantenlänge in CSS-px – Kompromiss aus Optik und Menge
  const particles: Particle[] = [];
  for (let y = 0; y < h; y += BLOCK) {
    for (let x = 0; x < w; x += BLOCK) {
      const i = (Math.floor(y * sy) * source.width + Math.floor(x * sx)) * 4;
      const a = img[i + 3];
      if (a < 24) continue; // (fast) transparente Stellen erzeugen keine Partikel
      // Nach rechts wegwehen + leicht aufsteigen, dann Schwerkraft – wie verwehende Krümel.
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.25) * 3,
        vy: -(Math.random() * 1.5 + 0.3),
        color: `rgba(${img[i]},${img[i + 1]},${img[i + 2]},${a / 255})`,
        life: 1,
        size: BLOCK,
      });
    }
  }

  const GRAVITY = 0.14;
  const DECAY = 0.045; // ~0.75 s bis unsichtbar
  let raf = 0;
  const step = (): void => {
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;
      p.life -= DECAY;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    if (alive) {
      raf = requestAnimationFrame(step);
    } else {
      cancelAnimationFrame(raf);
      cv.remove();
    }
  };
  raf = requestAnimationFrame(step);
}
