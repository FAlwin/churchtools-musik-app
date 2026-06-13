import { useCallback, useEffect, useRef, useState } from 'react';

/** Geometrie des Spalten-Layouts (in Pixeln) – kommt aus ChordChart. */
export interface PageGeometry {
  /** Blätter-Takt einer Seite: cols · (Spaltenbreite + Lücke). */
  pageStep: number;
  /** Breite einer Spalte inkl. Lücke. */
  columnStep: number;
  /** Innenabstand links/rechts des Inhalts. */
  pad: number;
  /** Anzahl Spalten pro Seite. */
  cols: number;
}

/**
 * Seitenweises Spalten-Layout für die Chart-Ansicht.
 * Der Inhalt fließt in Spalten fester Höhe (Bildschirmhöhe); passt er nicht auf
 * eine Seite, entstehen weitere Seiten, durch die geblättert wird.
 *
 * Die Seitenzahl wird NICHT über `scrollWidth` ermittelt – WebKit (Safari/iPad)
 * meldet die scrollbare Breite bei lückigen Multicol-Spalten zu klein. Stattdessen
 * verrät ein unsichtbarer End-Marker (`endRef`, letztes Kind des Inhalts) per
 * Layout-Position, in welcher Spalte der Inhalt endet. `contentWidth` (zurückgegeben)
 * dient als Breite eines Platzhalters, der die korrekte Scrollbreite erzwingt, damit
 * jede Seite auch wirklich erreichbar ist.
 */
export function usePagedColumns(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  endRef: React.RefObject<HTMLDivElement | null>,
  geom: PageGeometry,
  deps: unknown[],
) {
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const snapTimer = useRef<number | null>(null);

  const { pageStep, columnStep, pad, cols } = geom;

  const measure = useCallback(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;
    const step = pageStep > 0 ? pageStep : el.clientWidth || 1;

    if (content && endRef.current && columnStep > 0 && cols > 0) {
      // Position des End-Markers relativ zum Inhalt selbst (transform-invariant, daher
      // auch während der Liedwechsel-Animation stabil). Der Marker sitzt am Anfang der
      // letzten Spalte → daraus Spaltenindex und Seitenzahl.
      const cRect = content.getBoundingClientRect();
      const mRect = endRef.current.getBoundingClientRect();
      const markerLeft = mRect.left - cRect.left;
      const markerTop = mRect.top - cRect.top;
      let lastCol = Math.max(0, Math.round((markerLeft - pad) / columnStep));
      // Sitzt der Marker ALLEIN ganz oben in einer Spalte, war die vorige Spalte exakt voll
      // und in diese frische Spalte fließt nur noch der Marker → keine Phantom-Seite zählen.
      if (lastCol > 0 && markerTop <= pad + 4) lastCol -= 1;
      const pages = Math.max(1, Math.floor(lastCol / cols) + 1);
      setPageCount(pages);
      setContentWidth(pages * step); // Platzhalter erzwingt scrollbare Breite für alle Seiten
    } else {
      // Notweg ohne Marker/Geometrie: über scrollWidth (kann unter WebKit zu klein sein)
      const cw = Math.max(content?.scrollWidth ?? 0, el.scrollWidth);
      setPageCount(Math.max(1, Math.round(cw / step)));
      setContentWidth(0);
    }
    setPage(Math.round(el.scrollLeft / step));
  }, [scrollRef, contentRef, endRef, pageStep, columnStep, pad, cols]);

  useEffect(() => {
    // Sofort messen und nach kurzer Ruhe noch einmal: Safari berechnet das Multicol-
    // Layout nach Schriftgrößen-/Zoom-Änderungen erst einen Tick später fertig.
    const r1 = requestAnimationFrame(measure);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    const t = window.setTimeout(measure, 140);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [scrollRef, contentRef, measure]);

  const goToPage = useCallback(
    (p: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const step = pageStep > 0 ? pageStep : el.clientWidth || 1;
      const clamped = Math.max(0, Math.min(p, pageCount - 1));
      // innerhalb des Lieds schnell wechseln (kein langsames Smooth-Scrollen)
      el.scrollLeft = clamped * step;
      setPage(clamped);
    },
    [scrollRef, pageStep, pageCount],
  );

  /** An Scroll-Container hängen: aktualisiert Seite und rastet nach kurzer Ruhe ein. */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = pageStep > 0 ? pageStep : el.clientWidth || 1;
    setPage(Math.round(el.scrollLeft / step));
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const target = Math.round(el.scrollLeft / step) * step;
      if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: 'smooth' });
    }, 120);
  }, [scrollRef, pageStep]);

  return { pageCount, page, goToPage, onScroll, contentWidth };
}
