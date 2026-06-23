import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/** Feste, orientierungs-unabhängige Seitengeometrie (in logischen, unskalierten Pixeln). */
export interface FixedPageGeometry {
  /** Breite einer festen Seite. */
  pageW: number;
  /** Höhe einer festen Seite. */
  pageH: number;
  /** Innenabstand der Seite. */
  pad: number;
  /** Lücke zwischen Seiten (= Spaltenabstand des Multicol-Flusses). */
  gap: number;
  /** Sichtbare Seiten nebeneinander (1 Hochformat, 2 Querformat). */
  perView: number;
}

/**
 * Seiten-Layout mit FESTER Geometrie (Issue #25, Weg B): Der Inhalt fließt in Spalten fester
 * Breite/Höhe (= eine Seite). Statt zu scrollen, wird der ganze Seiten-Stapel per `transform`
 * skaliert und verschoben – so passt eine (Hochformat) bzw. passen zwei (Querformat) Seiten
 * formatfüllend auf den Bildschirm, und Anmerkungen können fest an der Seite kleben.
 *
 * Die Seitenzahl kommt – wie beim alten Layout – aus der Layout-Position eines unsichtbaren
 * End-Markers (zuverlässiger als WebKits `scrollWidth`).
 */
export function useFixedPages(
  stageRef: React.RefObject<HTMLDivElement | null>,
  flowRef: React.RefObject<HTMLDivElement | null>,
  endRef: React.RefObject<HTMLDivElement | null>,
  geom: FixedPageGeometry,
  deps: unknown[],
) {
  const { pageW, pageH, pad, gap, perView } = geom;
  const columnStep = pageW + gap; // ein Seiten-Takt im Fluss (unskaliert)

  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0); // Index der linken sichtbaren Seite
  const [stage, setStage] = useState({ w: 0, h: 0 });

  // Sichtbare Bühnengröße messen
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);

  // Seitenzahl aus der Spalte messen, in der der End-Marker sitzt
  const measure = useCallback(() => {
    const flow = flowRef.current;
    const marker = endRef.current;
    if (!flow || !marker || columnStep <= 0) return;
    const fRect = flow.getBoundingClientRect();
    const mRect = marker.getBoundingClientRect();
    // transform-invariant: Position relativ zum (evtl. skalierten) Fluss zurückrechnen
    const scale = fRect.width > 0 && flow.offsetWidth > 0 ? fRect.width / flow.offsetWidth : 1;
    const markerLeft = (mRect.left - fRect.left) / (scale || 1);
    const markerTop = (mRect.top - fRect.top) / (scale || 1);
    let lastCol = Math.max(0, Math.round((markerLeft - pad) / columnStep));
    // Marker allein oben in frischer Spalte → vorige Spalte war exakt voll, keine Phantom-Seite
    if (lastCol > 0 && markerTop <= pad + 4) lastCol -= 1;
    setPageCount(Math.max(1, lastCol + 1));
  }, [flowRef, endRef, columnStep, pad]);

  useEffect(() => {
    const r1 = requestAnimationFrame(measure);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    const t = window.setTimeout(measure, 140);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, stage.w, stage.h, ...deps]);

  // Skalierung: perView Seiten + Lücken sollen in die Bühne passen (Breite UND Höhe)
  const contentW = perView * pageW + (perView - 1) * gap;
  const scale =
    stage.w > 0 && stage.h > 0 ? Math.min(stage.w / contentW, stage.h / pageH) : 1;

  // Aktuelle Seite einrasten, falls pageCount/perView sich ändern
  const maxStart = Math.max(0, pageCount - perView);
  const clampedPage = Math.min(page, maxStart);

  const goToPage = useCallback(
    (p: number) => {
      setPage(Math.max(0, Math.min(p, Math.max(0, pageCount - perView))));
    },
    [pageCount, perView],
  );

  // Versatz (unskaliert) + horizontale Zentrierung des sichtbaren Blocks
  const shownW = contentW * scale;
  const centerX = stage.w > shownW ? (stage.w - shownW) / 2 : 0;
  const offsetPx = clampedPage * columnStep;

  return {
    pageCount,
    page: clampedPage,
    perView,
    goToPage,
    scale,
    /** CSS-transform für den Seiten-Stapel. */
    transform: `translateX(${centerX}px) scale(${scale}) translateX(${-offsetPx}px)`,
    /** Volle (unskalierte) Breite des Flusses – für die Canvas-Größe. */
    flowWidth: Math.max(contentW, pageCount * columnStep),
  };
}
