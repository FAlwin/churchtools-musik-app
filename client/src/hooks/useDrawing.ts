import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawTool, TextAnnotation } from '../types/index';
import { hasOpaquePixel } from '../utils/canvas';

interface UseDrawingArgs {
  songId: number;
  drawMode: boolean;
  drawColor: string;
  drawTool: DrawTool;
  textSize: number;
  /** Feste logische Seitenhöhe (Issue #25). Ist sie gesetzt, deckt die Leinwand die feste
   *  Seitenhöhe ab (nicht die sichtbare Container-Höhe) und skaliert per CSS-transform mit. */
  pageHeight?: number;
  /** Layout-Werte, bei deren Änderung die Leinwand neu vermessen wird. */
  layoutDeps: unknown[];
}

interface Point {
  x: number;
  y: number;
}

/** Ist die Leinwand komplett leer (kein einziger gezeichneter Pixel)? */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.width || !canvas.height) return true;
  return !hasOpaquePixel(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

/**
 * Kapselt das Zeichnen auf einer Canvas-Ebene über dem Chart:
 * Stift/Marker/Radierer, Text-Anmerkungen, Persistenz pro Song in localStorage.
 *
 * Gibt Refs für <canvas> und Scroll-Container sowie Pointer-Handler zurück.
 */
export function useDrawing({
  songId,
  drawMode,
  drawColor,
  drawTool,
  textSize,
  pageHeight,
  layoutDeps,
}: UseDrawingArgs) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const strokePtsRef = useRef<Point[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);

  const [textObjects, setTextObjects] = useState<TextAnnotation[]>([]);
  // pendingText: Eingabe-Overlay. Mit editId/initial wird ein VORHANDENER Text bearbeitet.
  const [pendingText, setPendingText] = useState<{
    x: number;
    y: number;
    cx: number;
    cy: number;
    editId?: number;
    initial?: string;
  } | null>(null);
  // Aktuell ausgewählte Text-Anmerkung (zum nachträglichen Ändern von Farbe/Größe/Inhalt).
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
  const dragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
    wasSelected: boolean;
  } | null>(null);
  // Verlauf für „Rückgängig"/„Wiederherstellen" (Canvas-Bild + Text-Liste je Schritt).
  const historyRef = useRef<{ img: string | null; texts: TextAnnotation[] }[]>([]);
  const redoRef = useRef<{ img: string | null; texts: TextAnnotation[] }[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Gibt es überhaupt Striche auf der Leinwand? (Texte werden separat über textObjects erkannt.)
  const [hasInk, setHasInk] = useState(false);

  // ── Persistenz: Strich-Bild laden / speichern ──
  const loadDrawing = useCallback((id: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const saved = localStorage.getItem(`worship_draw_${id}`);
    if (!saved) {
      setHasInk(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      const cx = c?.getContext('2d');
      if (!c || !cx) return;
      cx.drawImage(img, 0, 0);
      // Alt-Einträge mit leerer Leinwand selbst heilen (sonst dauerhaft „gesperrt").
      if (isCanvasBlank(c)) {
        setHasInk(false);
        localStorage.removeItem(`worship_draw_${id}`);
      } else {
        setHasInk(true);
      }
    };
    img.src = saved;
  }, []);

  const saveDrawing = useCallback((id: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    // Leere Leinwand NICHT speichern – sonst gilt das Lied fälschlich als „angemerkt"
    // und der Bearbeiten-Modus bliebe gesperrt, obwohl nichts gezeichnet wurde.
    if (isCanvasBlank(canvas)) {
      localStorage.removeItem(`worship_draw_${id}`);
      return;
    }
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
      // Containers – sonst bläht die Leinwand selbst die Scrollbreite auf).
      canvas.width = contentRef.current?.scrollWidth || wrap.offsetWidth;
      // Höhe: feste Seitenhöhe (Issue #25), sonst die sichtbare Container-Höhe.
      canvas.height = pageHeight ?? wrap.clientHeight;
      loadDrawing(id);
    },
    [loadDrawing, pageHeight],
  );

  // Text-Anmerkungen pro Song laden
  useEffect(() => {
    const saved = localStorage.getItem(`worship_text_${songId}`);
    setTextObjects(saved ? (JSON.parse(saved) as TextAnnotation[]) : []);
    setSelectedTextId(null);
    historyRef.current = []; // Verlauf gilt nur pro Lied
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [songId]);

  // ── Rückgängig / Wiederherstellen ──
  /** Aktuellen Zustand (Canvas-Bild + Text-Liste) als Schnappschuss. */
  function captureSnapshot() {
    const canvas = canvasRef.current;
    const img = canvas && canvas.width && !isCanvasBlank(canvas) ? canvas.toDataURL('image/png', 0.7) : null;
    return { img, texts: textObjects };
  }

  /** Schnappschuss anwenden (Canvas neu zeichnen + Texte setzen). */
  function applySnapshot(snap: { img: string | null; texts: TextAnnotation[] }) {
    setSelectedTextId(null);
    setTextObjects(snap.texts);
    setHasInk(!!snap.img);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (snap.img) {
      const im = new Image();
      im.onload = () => {
        const c = canvasRef.current;
        const cc = c?.getContext('2d');
        if (c && cc) {
          cc.clearRect(0, 0, c.width, c.height);
          cc.drawImage(im, 0, 0);
        }
        saveDrawing(songId);
      };
      im.src = snap.img;
    } else {
      saveDrawing(songId);
    }
  }

  /** Zustand sichern – VOR einer Änderung aufrufen. Setzt den Wiederherstellen-Verlauf zurück. */
  function pushHistory() {
    historyRef.current.push(captureSnapshot());
    if (historyRef.current.length > 30) historyRef.current.shift();
    redoRef.current = []; // eine neue Aktion macht „Wiederherstellen" ungültig
    setCanUndo(true);
    setCanRedo(false);
  }

  /** Letzte Änderung rückgängig machen. */
  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(captureSnapshot());
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    applySnapshot(prev);
  }

  /** Rückgängig gemachte Änderung wiederherstellen. */
  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(captureSnapshot());
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    applySnapshot(next);
  }

  // Auswahl aufheben, sobald der Zeichenmodus verlassen wird
  useEffect(() => {
    if (!drawMode) setSelectedTextId(null);
  }, [drawMode]);

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
    // Auf die internen Canvas-Maße umrechnen – berücksichtigt automatisch eine CSS-Skalierung
    // (Issue #25: die Leinwand sitzt im skalierten Seiten-Container).
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
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
    // Ist gerade ein Text-Eingabefeld offen, beendet dieser Tipp NUR die Eingabe
    // (das onBlur des Felds speichert) – es wird KEIN neuer Text angelegt.
    if (pendingText) return;
    // Tippen auf eine leere Stelle hebt die Text-Auswahl auf (Texte stoppen das Event selbst).
    setSelectedTextId(null);
    if (drawTool === 'text') {
      e.preventDefault();
      e.stopPropagation();
      const pt = getCanvasPt(e);
      setPendingText({ x: pt.x, y: pt.y, cx: e.clientX, cy: e.clientY });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    pushHistory(); // Zustand vor dem Strich sichern (für Rückgängig)
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
    setHasInk(true);
    saveDrawing(songId);
  }

  // ── Text-Anmerkungen ──
  function confirmText(text: string) {
    if (!pendingText) return;
    const trimmed = text.trim();
    if (pendingText.editId != null) {
      // Vorhandenen Text ändern – oder löschen, wenn er leer geräumt wurde.
      pushHistory();
      setTextObjects((prev) =>
        trimmed
          ? prev.map((o) => (o.id === pendingText.editId ? { ...o, text: trimmed } : o))
          : prev.filter((o) => o.id !== pendingText.editId),
      );
    } else if (trimmed) {
      pushHistory();
      setTextObjects((prev) => [
        ...prev,
        { id: Date.now(), x: pendingText.x, y: pendingText.y, text: trimmed, color: drawColor, size: textSize },
      ]);
    }
    setPendingText(null);
  }

  /** Inhalt einer vorhandenen Text-Anmerkung bearbeiten (öffnet das Eingabefeld). */
  function editText(obj: TextAnnotation) {
    const rect = canvasRef.current?.getBoundingClientRect();
    setPendingText({
      x: obj.x,
      y: obj.y,
      cx: (rect?.left ?? 0) + obj.x,
      cy: (rect?.top ?? 0) + obj.y,
      editId: obj.id,
      initial: obj.text,
    });
  }

  function deleteText(id: number) {
    pushHistory();
    setTextObjects((prev) => prev.filter((o) => o.id !== id));
  }

  function startDragText(e: React.PointerEvent, obj: TextAnnotation) {
    e.stopPropagation();
    // War der Text schon ausgewählt? Dann gilt ein reiner Tipp (ohne Verschieben) als
    // „Bearbeiten" (siehe endDragText). Erster Tipp wählt nur aus.
    const wasSelected = selectedTextId === obj.id;
    setSelectedTextId(obj.id);
    dragRef.current = { id: obj.id, sx: e.clientX, sy: e.clientY, ox: obj.x, oy: obj.y, moved: false, wasSelected };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  /** Farbe einer vorhandenen Text-Anmerkung ändern (live). */
  function setTextColor(id: number, color: string) {
    setTextObjects((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)));
  }

  /** Größe einer vorhandenen Text-Anmerkung ändern (live, begrenzt 12–56). */
  function resizeText(id: number, delta: number) {
    setTextObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, size: Math.max(12, Math.min(56, o.size + delta)) } : o)),
    );
  }

  function moveDragText(e: React.PointerEvent, id: number) {
    if (!dragRef.current || dragRef.current.id !== id) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    // Erst beim tatsächlichen Verschieben den Zustand für Rückgängig sichern (nicht beim reinen Antippen).
    if (!dragRef.current.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      dragRef.current.moved = true;
      pushHistory();
    }
    setTextObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: dragRef.current!.ox + dx, y: dragRef.current!.oy + dy } : o)),
    );
  }

  function endDragText() {
    const d = dragRef.current;
    dragRef.current = null;
    // Reiner Tipp (kein Verschieben) auf einen BEREITS ausgewählten Text → bearbeiten.
    if (d && !d.moved && d.wasSelected) {
      const obj = textObjects.find((o) => o.id === d.id);
      if (obj) editText(obj);
    }
  }

  function clearAll() {
    pushHistory(); // „Alles löschen" rückgängig machbar: ↺ holt alles zurück
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(`worship_draw_${songId}`);
    localStorage.removeItem(`worship_text_${songId}`);
    setSelectedTextId(null);
    setTextObjects([]);
    setHasInk(false);
  }

  return {
    canvasRef,
    bodyRef,
    contentRef,
    textObjects,
    pendingText,
    selectedTextId,
    canUndo,
    canRedo,
    // Sind Anmerkungen vorhanden? (Striche oder Texte) – sperrt Schrift/Spalten.
    hasAnnotations: hasInk || textObjects.length > 0,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
    confirmText,
    editText,
    deleteText,
    setTextColor,
    resizeText,
    undo,
    redo,
    clearTextSelection: () => setSelectedTextId(null),
    startDragText,
    moveDragText,
    endDragText,
    clearAll,
    saveDrawing,
  };
}
