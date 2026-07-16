import {
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DrawTool } from '../types/index';

/** Der Teil einer usePageDraw-Instanz, den die Zeichen-Engine ansteuert (Verlauf + Speichern). */
export interface StrokeDrawTarget {
  setSelectedId: (id: number | null) => void;
  pushHistory: () => void;
  dropHistory: () => void;
  saveStrokes: () => void;
}

interface UsePointerStrokesParams {
  /** Anno-Canvas je sichtbarem Slot (dort wird gezeichnet). */
  annoRefs: MutableRefObject<HTMLCanvasElement | null>[];
  /** usePageDraw-Ziele je Slot (Verlauf/Speichern). */
  draws: StrokeDrawTarget[];
  drawMode: boolean;
  drawTool: DrawTool;
  drawColor: string;
  toolSizes: { pen: number; marker: number; eraser: number };
  perView: number;
  activeSlot: number;
  pageIndex: number;
  onActivePage: (page: number) => void;
}

/**
 * Zeichen-Engine für die Anno-Canvas (Stift/Marker/Radierer) – aus PageDeck ausgelagert.
 *
 * Kapselt den kompletten Pointer-Lebenszyklus eines Strichs samt der heiklen Touch-Regeln:
 * Pointer-Capture (Move/Up kommen garantiert an), Handballen-Unterdrückung (Stift zeichnet, Finger
 * ignoriert), Zwei-Finger-Geste bricht den Finger-Strich ab (bleibt dem Zoom/Verschieben
 * vorbehalten), Marker als EINE halbtransparente Linie (Schnappschuss-Technik), Radierer via
 * `destination-out`. Ein Sicherheits-Effekt setzt den Zustand bei Modus-/Seitenwechsel zurück
 * (keine hängengebliebenen Striche). Verhalten identisch zur früheren Inline-Fassung.
 */
export function usePointerStrokes({
  annoRefs,
  draws,
  drawMode,
  drawTool,
  drawColor,
  toolSizes,
  perView,
  activeSlot,
  pageIndex,
  onActivePage,
}: UsePointerStrokesParams) {
  const stroke = useRef(false);
  const strokePointer = useRef(-1);
  const strokePointerType = useRef<string>('');
  const strokeCanvas = useRef<HTMLCanvasElement | null>(null);
  const strokeSlot = useRef(0);
  const strokeSnapshot = useRef<HTMLCanvasElement | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const markerBase = useRef<HTMLCanvasElement | null>(null);
  const markerPts = useRef<{ x: number; y: number }[]>([]);

  function ptOf(e: ReactPointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  // Laufenden Strich verwerfen (zweiter Finger = Zoom/Verschieben, kein Zeichnen): Canvas auf den
  // Schnappschuss vor dem Strich zurücksetzen und den Verlaufseintrag entfernen.
  function cancelStroke() {
    if (!stroke.current) return;
    const canvas = strokeCanvas.current;
    const snap = strokeSnapshot.current;
    if (canvas && snap) {
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(snap, 0, 0);
    }
    try {
      canvas?.releasePointerCapture(strokePointer.current);
    } catch {
      /* ignorieren */
    }
    draws[strokeSlot.current].dropHistory();
    stroke.current = false;
    strokePointer.current = -1;
    strokePointerType.current = '';
    lastPt.current = null;
    markerBase.current = null;
    markerPts.current = [];
    strokeCanvas.current = null;
    strokeSnapshot.current = null;
  }

  function strokeDown(e: ReactPointerEvent, slot: number) {
    if (!drawMode || drawTool === 'text') return;
    // Zweiter Zeiger während eines laufenden Strichs:
    if (stroke.current && e.pointerId !== strokePointer.current) {
      // Stift zeichnet + Finger dazu → Handballen ignorieren (Strich läuft weiter).
      if (strokePointerType.current === 'pen' && e.pointerType === 'touch') return;
      // Finger zeichnete + zweiter Zeiger dazu → das war eine Zoom-/Verschiebe-Geste: verwerfen.
      cancelStroke();
      return;
    }
    // Nur der primäre Finger startet einen Strich (zweiter Finger beim Multitouch ignorieren) →
    // so bleibt die Zwei-Finger-Geste dem Zoom/Verschieben vorbehalten, auch im Zeichenmodus.
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    // #53: Auf der inaktiven Seite wird NICHT gezeichnet – der Tipp aktiviert sie nur.
    if (perView === 2 && slot !== activeSlot) {
      e.stopPropagation();
      onActivePage(pageIndex + slot);
      return;
    }
    const canvas = annoRefs[slot].current;
    if (!canvas) return;
    e.stopPropagation();
    // Pointer einfangen → Move/Up kommen GARANTIERT an, auch wenn der Finger die Fläche verlässt
    // (verhindert hängengebliebene, nicht beendete Striche).
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignorieren */
    }
    // Schnappschuss vor dem Strich (für Marker-Glättung UND zum Verwerfen bei Zwei-Finger-Geste).
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    strokeSnapshot.current = snap;
    draws[slot].setSelectedId(null);
    draws[slot].pushHistory();
    stroke.current = true;
    strokePointer.current = e.pointerId;
    strokePointerType.current = e.pointerType;
    strokeCanvas.current = canvas;
    strokeSlot.current = slot;
    lastPt.current = ptOf(e, canvas);
    if (drawTool === 'marker') {
      markerBase.current = snap; // gleicher Schnappschuss = Basis für den Leuchtmarker-Strich
      markerPts.current = [lastPt.current];
    }
  }

  function strokeMove(e: ReactPointerEvent) {
    if (!stroke.current || strokePointer.current !== e.pointerId || !strokeCanvas.current) return;
    const canvas = strokeCanvas.current;
    const ctx = canvas.getContext('2d')!;
    const p = ptOf(e, canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawTool === 'marker' && markerBase.current) {
      // Den ganzen bisherigen Marker-Strich als EINE halbtransparente Linie neu zeichnen
      // (auf dem Schnappschuss) → gleichmäßiger Leuchtmarker statt Punktreihe.
      markerPts.current.push(p);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(markerBase.current, 0, 0);
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = toolSizes.marker;
      ctx.strokeStyle = drawColor;
      const pts = markerPts.current;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      lastPt.current = p;
      return;
    }
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = toolSizes.eraser;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.lineWidth = toolSizes.pen;
      ctx.strokeStyle = drawColor;
    }
    ctx.beginPath();
    ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    lastPt.current = p;
  }

  function strokeUp(e?: ReactPointerEvent) {
    if (!stroke.current) return;
    if (e && strokePointer.current !== e.pointerId) return;
    stroke.current = false;
    strokePointer.current = -1;
    strokePointerType.current = '';
    lastPt.current = null;
    markerBase.current = null;
    markerPts.current = [];
    strokeSnapshot.current = null;
    draws[strokeSlot.current].saveStrokes();
    strokeCanvas.current = null;
  }

  // Sicherheit gegen hängengebliebene Striche: beim Verlassen des Zeichenmodus/Seitenwechsel
  // den Zeichen-Zustand zurücksetzen.
  useEffect(() => {
    stroke.current = false;
    strokePointer.current = -1;
    strokeCanvas.current = null;
    lastPt.current = null;
  }, [drawMode, pageIndex, perView]);

  return { strokeDown, strokeMove, strokeUp };
}
