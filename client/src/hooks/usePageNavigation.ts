import { useRef } from 'react';

interface UsePageNavigationParams {
  pageIndex: number;
  pageCount: number;
  /** 1 (Hochformat) oder 2 (Querformat). */
  perView: number;
  /** Im Anmerkungsmodus wird nicht geblättert – dort gehört der Finger dem Stift. */
  drawMode: boolean;
  onPageIndex: (i: number) => void;
  onActivePage: (i: number) => void;
  /**
   * Tipp in die MITTE (#319) – blendet Kopf- und Fußzeile aus bzw. wieder ein.
   *
   * Optional, weil das Blättern auch ohne funktionieren muss: `PageDeck` wird nicht nur von der
   * Chart-Ansicht benutzt.
   */
  onMiddleTap?: () => void;
}

/**
 * Blättern per Wisch und Tipp (#193 – vorher inline in `PageDeck`).
 *
 * Drei Zonen: linkes Fünftel zurück, rechtes Fünftel weiter, Mitte blendet die Leisten aus bzw.
 * wieder ein (#319) und wählt im Querformat zusätzlich die angetippte Hälfte als aktive Seite. Ein Wisch braucht ≥45 px und muss deutlich waagerechter als
 * senkrecht sein, ein Tipp darf sich kaum bewegen (<12 px) – dazwischen passiert nichts, damit ein
 * abgebrochener Wisch nicht als Tipp durchgeht.
 *
 * `suppressClick`: iOS reicht nach einem Touch zusätzlich ein `click` nach. Ohne die Sperre würde
 * jede Wisch-/Tipp-Navigation doppelt ausgeführt und eine Seite übersprungen.
 */
export function usePageNavigation({
  pageIndex,
  pageCount,
  perView,
  drawMode,
  onPageIndex,
  onActivePage,
  onMiddleTap,
}: UsePageNavigationParams) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  // Max. linke Seite: im 2-up so, dass NIE eine Seite allein rechts steht (immer 2 sichtbar);
  // nur bei genau 1 Seite gesamt bleibt eine einzelne (linksbündige) Seite.
  const maxLeft = perView === 2 && pageCount > 1 ? pageCount - 2 : Math.max(0, pageCount - 1);

  function go(delta: number) {
    const target = pageIndex + delta;
    // Am Rand stehen bleiben. Früher gab es hier optionale Haken für „voriges/nächstes Lied" – seit
    // der Seitenstrom über ALLE Lieder durchgeht, sind sie überflüssig und wurden nie gesetzt (#251).
    if (target < 0 || target > maxLeft) return;
    if (target !== pageIndex) {
      onPageIndex(target);
      onActivePage(target);
    }
  }

  function tapAt(clientX: number, root: HTMLElement) {
    const r = root.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    if (fx < 0.18) {
      go(-1); // linker Rand → zurück
      return;
    }
    if (fx > 0.82) {
      go(1); // rechter Rand → weiter
      return;
    }
    // Mitte: Kopf- und Fußzeile aus-/einblenden (#319) – in BEIDEN Ausrichtungen, damit die
    // Bedienung sich nicht mit dem Drehen ändert.
    onMiddleTap?.();
    if (perView < 2) return;
    // Im Querformat macht derselbe Tipp zusätzlich die angetippte Hälfte aktiv. Beides zusammen
    // ist gewollt: Die Kopfzeile bezieht sich danach auf das Lied, das man gerade angesehen hat.
    const slot = fx < 0.5 ? 0 : 1;
    const target = pageIndex + slot;
    if (target < pageCount) onActivePage(target);
  }

  function onTouchStart(e: React.TouchEvent) {
    // Ein Finger = blättern (hier). Zwei+ Finger gehören der Zoom-Bibliothek (Zoom + Verschieben).
    if (drawMode || e.touches.length > 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (drawMode || !touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    const startX = touchStart.current.x;
    touchStart.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx > 0 ? 1 : -1);
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) tapAt(startX, e.currentTarget as HTMLElement);
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 500);
  }

  function onClick(e: React.MouseEvent) {
    if (drawMode) return;
    if (suppressClick.current) {
      suppressClick.current = false; // war ein Touch-Tap (schon behandelt) → Klick ignorieren
      return;
    }
    tapAt(e.clientX, e.currentTarget as HTMLElement);
  }

  return { onTouchStart, onTouchEnd, onClick };
}
