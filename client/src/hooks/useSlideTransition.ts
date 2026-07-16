import { useLayoutEffect, useRef, useState } from 'react';
import type { PageTextObj } from './usePageDraw';
import type { ZoomState } from './useZoomPersistence';

/** Eine fertig zusammengesetzte Seite (Inhalt + Striche) für den Slide-Übergangs-Streifen. */
export interface SlideSlot {
  canvas: HTMLCanvasElement;
  texts: PageTextObj[];
  zoom: ZoomState | null;
  aspect: string;
}

interface UseSlideTransitionParams {
  pageIndex: number;
  perView: number;
  pages: HTMLCanvasElement[];
  loading: boolean;
  /** Baut eine Streifen-Hälfte (1–2 Seiten ab `start`) – bleibt in PageDeck (Zeichen-Interna). */
  composePane: (start: number) => SlideSlot[];
}

/**
 * Slide-Übergang beim Blättern (horizontales Schieben wie im Foto-Viewer).
 *
 * Löst einen Slide aus, wenn sich NUR die Seite um ±1 ändert (Blättern); Layout-/Strom-Wechsel
 * (Drehen, Neuaufbau, Sprung übers Lied-Menü) schalten weiterhin hart um. Beide Effekte sind
 * `useLayoutEffect`: die Abdeckung bzw. die Startpositionen müssen VOR dem ersten gezeichneten
 * Frame stehen, sonst blitzt der veraltete Anmerkungs-Stand auf (#113, Safari flusht passive
 * Effekte nicht zuverlässig vor dem Paint).
 *
 * Gibt `slide`/`slidePanes`/`slideOverlayRef` fürs Rendern des Streifens zurück.
 */
export function useSlideTransition({
  pageIndex,
  perView,
  pages,
  loading,
  composePane,
}: UseSlideTransitionParams) {
  const [slide, setSlide] = useState<{ dir: 1 | -1; tick: number } | null>(null);
  const slidePanes = useRef<{ old: SlideSlot[]; neu: SlideSlot[] } | null>(null);
  const slideOverlayRef = useRef<HTMLDivElement | null>(null);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPageIndex = useRef<number | null>(null);
  const slideGuard = useRef<{ perView: number; pages: HTMLCanvasElement[] } | null>(null);

  // Slide auslösen, wenn sich NUR die Seite um ±1 ändert (Blättern).
  useLayoutEffect(() => {
    const prev = prevPageIndex.current;
    prevPageIndex.current = pageIndex;
    const guard = slideGuard.current;
    slideGuard.current = { perView, pages };
    if (prev === null || loading) return;
    if (!guard || guard.perView !== perView || guard.pages !== pages) return;
    const delta = pageIndex - prev;
    if (Math.abs(delta) !== 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const old = composePane(prev);
    const neu = composePane(pageIndex);
    if (!old.length || !neu.length) return;
    slidePanes.current = { old, neu };
    setSlide({ dir: delta > 0 ? 1 : -1, tick: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, perView, pages, loading]);

  // Slide abspielen: alte und neue Ebene (je bildschirmbreit) GLEICHZEITIG horizontal schieben.
  useLayoutEffect(() => {
    if (!slide) return;
    const overlay = slideOverlayRef.current;
    const oldPane = overlay?.querySelector<HTMLElement>('[data-pane="old"]');
    const neuPane = overlay?.querySelector<HTMLElement>('[data-pane="neu"]');
    if (!overlay || !oldPane || !neuPane) {
      setSlide(null);
      return;
    }
    // Text-Ebenen exakt auf die (unskalierte) Layout-Größe ihrer Seiten-Canvas bringen –
    // container-type:size macht die cqh-Schriftgrößen dann seitenrelativ wie in der Live-Ansicht.
    overlay.querySelectorAll<HTMLElement>('[data-slide-textlayer]').forEach((tl) => {
      const cv = tl.previousElementSibling as HTMLElement | null;
      if (cv) {
        tl.style.width = `${cv.offsetWidth}px`;
        tl.style.height = `${cv.offsetHeight}px`;
      }
    });
    // Startpositionen: alte Ebene deckt den Bildschirm, neue steht daneben (vorwärts rechts,
    // rückwärts links). Beide Richtungen ENDEN bei translateX(0) – pixelgenau wie die Live-Ansicht.
    oldPane.style.transition = 'none';
    neuPane.style.transition = 'none';
    oldPane.style.transform = 'translateX(0)';
    neuPane.style.transform = `translateX(${slide.dir === 1 ? '100%' : '-100%'})`;
    void overlay.offsetWidth; // Reflow → Startpositionen stehen, bevor die Transition beginnt
    const tr = 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    oldPane.style.transition = tr;
    neuPane.style.transition = tr;
    oldPane.style.transform = `translateX(${slide.dir === 1 ? '-100%' : '100%'})`;
    neuPane.style.transform = 'translateX(0)';
    slideTimer.current = setTimeout(() => {
      slidePanes.current = null;
      setSlide(null);
    }, 300);
    return () => {
      if (slideTimer.current) clearTimeout(slideTimer.current);
    };
  }, [slide]);

  return { slide, slidePanes, slideOverlayRef };
}
