import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawTool, TextAnnotation } from '../types/index';

interface UseDrawingArgs {
  songId: number;
  drawMode: boolean;
  drawColor: string;
  drawTool: DrawTool;
  textSize: number;
  /** Layout-Werte, bei deren Änderung die Leinwand neu vermessen wird. */
  layoutDeps: unknown[];
}

interface Point {
  x: number;
  y: number;
}

/**
 * Kapselt das Zeichnen auf einer Canvas-Ebene über dem Chart:
 * Stift/Marker/Radierer, Text-Anmerkungen, Persistenz pro Song in localStorage.
 *
 * Gibt Refs für <canvas> und Scroll-Container sowie Pointer-Handler zurück.
 */
export function useDrawing({ songId, drawMode, drawColor, drawTool, textSize, layoutDeps }: UseDrawingArgs) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const strokePtsRef = useRef<Point[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);

  const [textObjects, setTextObjects] = useState<TextAnnotation[]>([]);
  const [pendingText, setPendingText] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);

  // ── Persistenz: Strich-Bild laden / speichern ──
  const loadDrawing = useCallback((id: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const saved = localStorage.getItem(`worship_draw_${id}`);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        canvasRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      };
      img.src = saved;
    }
  }, []);

  const saveDrawing = useCallback((id: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    try {
      localStorage.setItem(`worship_draw_${id}`, canvas.toDataURL('image/png', 0.7));
    } catch {
      // Speicher voll – ignorieren
    }
  }, []);

  const fitCanvas = useCallback(
    (id: number) => {
      const canvas = canvasRef.current;
      const wrap = bodyRef.current;
      if (!canvas || !wrap) return;
      // Leinwand deckt genau die Inhaltsbreite ab (nicht die Scrollbreite des
      // Containers – sonst bläht die Leinwand selbst die Scrollbreite auf)
      canvas.width = contentRef.current?.scrollWidth || wrap.offsetWidth;
      canvas.height = wrap.clientHeight;
      loadDrawing(id);
    },
    [loadDrawing],
  );

  // Text-Anmerkungen pro Song laden
  useEffect(() => {
    const saved = localStorage.getItem(`worship_text_${songId}`);
    setTextObjects(saved ? (JSON.parse(saved) as TextAnnotation[]) : []);
  }, [songId]);

  // Text-Anmerkungen speichern
  useEffect(() => {
    if (textObjects.length > 0) {
      localStorage.setItem(`worship_text_${songId}`, JSON.stringify(textObjects));
    } else {
      localStorage.removeItem(`worship_text_${songId}`);
    }
  }, [textObjects, songId]);

  // Leinwand neu vermessen, wenn sich das Layout ändert
  useEffect(() => {
    const r = requestAnimationFrame(() => fitCanvas(songId));
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, fitCanvas, ...layoutDeps]);

  // ── Zeichnen ──
  function getCanvasPt(e: React.PointerEvent): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Ganzen Strich aus dem Snapshot neu zeichnen (gleichmäßiger Marker statt Punkte)
  function renderStroke() {
    const canvas = canvasRef.current;
    if (!canvas || !snapshotRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(snapshotRef.current, 0, 0);
    const pts = strokePtsRef.current;
    if (!pts.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 26;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (drawTool === 'marker') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 18;
      ctx.strokeStyle = drawColor;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = drawColor;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) {
      ctx.lineTo(pts[0].x + 0.1, pts[0].y);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!drawMode) return;
    if (drawTool === 'text') {
      e.preventDefault();
      e.stopPropagation();
      const pt = getCanvasPt(e);
      setPendingText({ x: pt.x, y: pt.y, cx: e.clientX, cy: e.clientY });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    strokePtsRef.current = [getCanvasPt(e)];
    renderStroke();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    strokePtsRef.current.push(getCanvasPt(e));
    renderStroke();
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    snapshotRef.current = null;
    strokePtsRef.current = [];
    saveDrawing(songId);
  }

  // ── Text-Anmerkungen ──
  function confirmText(text: string) {
    if (!pendingText) return;
    if (text && text.trim()) {
      setTextObjects((prev) => [
        ...prev,
        { id: Date.now(), x: pendingText.x, y: pendingText.y, text: text.trim(), color: drawColor, size: textSize },
      ]);
    }
    setPendingText(null);
  }

  function deleteText(id: number) {
    setTextObjects((prev) => prev.filter((o) => o.id !== id));
  }

  function startDragText(e: React.PointerEvent, obj: TextAnnotation) {
    e.stopPropagation();
    dragRef.current = { id: obj.id, sx: e.clientX, sy: e.clientY, ox: obj.x, oy: obj.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function moveDragText(e: React.PointerEvent, id: number) {
    if (!dragRef.current || dragRef.current.id !== id) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setTextObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: dragRef.current!.ox + dx, y: dragRef.current!.oy + dy } : o)),
    );
  }

  function endDragText() {
    dragRef.current = null;
  }

  function clearAll() {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(`worship_draw_${songId}`);
    localStorage.removeItem(`worship_text_${songId}`);
    setTextObjects([]);
  }

  return {
    canvasRef,
    bodyRef,
    contentRef,
    textObjects,
    pendingText,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
    confirmText,
    deleteText,
    startDragText,
    moveDragText,
    endDragText,
    clearAll,
    saveDrawing,
  };
}
