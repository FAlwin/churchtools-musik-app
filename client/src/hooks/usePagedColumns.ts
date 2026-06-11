import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Seitenweises Spalten-Layout für die Chart-Ansicht.
 * Der Inhalt fließt in Spalten fester Höhe (Bildschirmhöhe); passt er nicht auf
 * eine Seite, entstehen weitere Seiten, durch die geblättert wird.
 *
 * Misst die Seitenanzahl am INHALT (contentRef), nicht am Scroll-Container –
 * sonst zählt z.B. die Zeichen-Leinwand eine leere Phantom-Seite mit.
 */
export function usePagedColumns(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  deps: unknown[],
) {
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0);
  const snapTimer = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;
    const pw = el.clientWidth || 1;
    const cw = content?.scrollWidth ?? el.scrollWidth;
    // round() statt ceil(): ein kleiner Überhang (Rand/Marge) erzeugt keine leere Seite
    setPageCount(Math.max(1, Math.round(cw / pw)));
    setPage(Math.round(el.scrollLeft / pw));
  }, [scrollRef, contentRef]);

  useEffect(() => {
    const r = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(r);
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
      const clamped = Math.max(0, Math.min(p, pageCount - 1));
      // innerhalb des Lieds schnell wechseln (kein langsames Smooth-Scrollen)
      el.scrollLeft = clamped * el.clientWidth;
      setPage(clamped);
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
    }, 120);
  }, [scrollRef]);

  return { pageCount, page, goToPage, onScroll };
}
