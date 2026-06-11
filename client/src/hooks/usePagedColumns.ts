import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Seitenweises Spalten-Layout für die Chart-Ansicht.
 * Der Inhalt fließt in Spalten fester Höhe (Bildschirmhöhe); passt er nicht auf
 * eine Seite, entstehen weitere Seiten, durch die horizontal gewischt wird.
 *
 * Misst Seitenanzahl/aktuelle Seite am scrollbaren Container und rastet beim
 * Loslassen auf die nächste Seite ein.
 */
export function usePagedColumns(scrollRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0);
  const snapTimer = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pw = el.clientWidth || 1;
    setPageCount(Math.max(1, Math.round(el.scrollWidth / pw)));
    setPage(Math.round(el.scrollLeft / pw));
  }, [scrollRef]);

  // Nach Layout-Änderungen (Song, Schriftgröße, Spalten …) neu vermessen
  useEffect(() => {
    const r = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  // Größenänderungen des Containers beobachten
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef, measure]);

  const goToPage = useCallback(
    (p: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(p, pageCount - 1));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    },
    [scrollRef, pageCount],
  );

  /** An Scroll-Container hängen: aktualisiert Seite und rastet nach kurzer Ruhe ein. */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pw = el.clientWidth || 1;
    setPage(Math.round(el.scrollLeft / pw));
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const target = Math.round(el.scrollLeft / pw) * pw;
      if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: 'smooth' });
    }, 130);
  }, [scrollRef]);

  return { pageCount, page, goToPage, onScroll };
}
