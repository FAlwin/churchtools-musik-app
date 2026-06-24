import { useEffect, useRef, useState } from 'react';
import { pushField } from '../services/annotations';

/** Eine Text-Anmerkung auf einer PDF-Seite. Position als Bruchteil der Seite (0..1), Größe in
 *  cqh (% der Seitenhöhe) → skaliert/zoomt verlustfrei mit der Seite mit. */
export interface PageTextObj {
  id: number;
  fx: number;
  fy: number;
  text: string;
  color: string;
  sizeCqh: number;
}

interface Snapshot {
  img: string | null;
  texts: PageTextObj[];
}

type CanvasRef = React.MutableRefObject<HTMLCanvasElement | null>;
type LayerRef = React.MutableRefObject<HTMLDivElement | null>;

/**
 * Voll-Anmerkungen für EINE PDF-Seite: Striche (auf der übergebenen Canvas) + Text-Objekte
 * (platzieren, verschieben, bearbeiten, Farbe/Größe) + Rückgängig/Wiederherstellen, persistiert
 * pro Seite in localStorage. Die Striche selbst zeichnet der Viewer auf die Canvas; dieser Hook
 * verwaltet Verlauf, Text und Persistenz.
 */
export function usePageDraw(storageKey: string | null, strokesRef: CanvasRef, layerRef: LayerRef, reloadTick = 0) {
  const [texts, setTexts] = useState<PageTextObj[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, setPending] = useState<{
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    editId?: number;
    initial?: string;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const history = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const drag = useRef<{ id: number; sx: number; sy: number; ofx: number; ofy: number; moved: boolean; wasSel: boolean } | null>(
    null,
  );

  const drawKey = storageKey;
  const textKey = storageKey ? `${storageKey}_text` : null;
  // Zuletzt geladener Text-Stand (JSON) – verhindert das Zurück-Pushen gerade geladener Daten.
  const loadedJson = useRef('[]');

  // Texte laden, wenn die Seite (Schlüssel) wechselt ODER nach einem Server-Pull (reloadTick).
  useEffect(() => {
    if (!textKey) {
      setTexts([]);
      loadedJson.current = '[]';
      return;
    }
    let loaded: PageTextObj[] = [];
    try {
      const s = localStorage.getItem(textKey);
      loaded = s ? (JSON.parse(s) as PageTextObj[]) : [];
    } catch {
      loaded = [];
    }
    setTexts(loaded);
    loadedJson.current = JSON.stringify(loaded);
    setSelectedId(null);
    history.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [textKey, reloadTick]);

  // Texte speichern (localStorage-Cache immer; Server-Push nur bei echter Änderung)
  useEffect(() => {
    if (!textKey || !drawKey) return;
    if (texts.length) localStorage.setItem(textKey, JSON.stringify(texts));
    else localStorage.removeItem(textKey);
    const norm = JSON.stringify(texts);
    if (norm !== loadedJson.current) {
      pushField(drawKey, 'texts', texts);
      loadedJson.current = norm;
    }
  }, [texts, textKey, drawKey]);

  function snapshot(): Snapshot {
    const c = strokesRef.current;
    const img = c && c.width ? c.toDataURL('image/png', 0.7) : null;
    return { img, texts };
  }
  function saveStrokes() {
    if (!drawKey) return;
    const c = strokesRef.current;
    if (!c || !c.width) return;
    const data = c.toDataURL('image/png', 0.7);
    try {
      localStorage.setItem(drawKey, data);
    } catch {
      /* Speicher voll */
    }
    pushField(drawKey, 'strokes', data);
  }
  function applySnapshot(s: Snapshot) {
    setSelectedId(null);
    setTexts(s.texts);
    const c = strokesRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (s.img) {
      const im = new Image();
      im.onload = () => {
        const cc = strokesRef.current;
        const ccx = cc?.getContext('2d');
        if (cc && ccx) {
          ccx.clearRect(0, 0, cc.width, cc.height);
          ccx.drawImage(im, 0, 0);
        }
        saveStrokes();
      };
      im.src = s.img;
    } else {
      saveStrokes();
    }
  }
  function pushHistory() {
    history.current.push(snapshot());
    if (history.current.length > 30) history.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }
  function undo() {
    const p = history.current.pop();
    if (!p) return;
    redoStack.current.push(snapshot());
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
    applySnapshot(p);
  }
  function redo() {
    const n = redoStack.current.pop();
    if (!n) return;
    history.current.push(snapshot());
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
    applySnapshot(n);
  }

  // ── Text ──
  function placeText(fx: number, fy: number, cx: number, cy: number) {
    setSelectedId(null);
    setPending({ fx, fy, cx, cy });
  }
  function confirmText(text: string, color: string, sizeCqh: number) {
    if (!pending) return;
    const t = text.trim();
    if (pending.editId != null) {
      pushHistory();
      setTexts((prev) =>
        t ? prev.map((o) => (o.id === pending.editId ? { ...o, text: t } : o)) : prev.filter((o) => o.id !== pending.editId),
      );
    } else if (t) {
      pushHistory();
      setTexts((prev) => [...prev, { id: Date.now(), fx: pending.fx, fy: pending.fy, text: t, color, sizeCqh }]);
    }
    setPending(null);
  }
  function cancelText() {
    setPending(null);
  }
  function editText(o: PageTextObj) {
    const rect = layerRef.current?.getBoundingClientRect();
    setPending({
      fx: o.fx,
      fy: o.fy,
      cx: (rect?.left ?? 0) + o.fx * (rect?.width ?? 0),
      cy: (rect?.top ?? 0) + o.fy * (rect?.height ?? 0),
      editId: o.id,
      initial: o.text,
    });
  }
  function deleteText(id: number) {
    pushHistory();
    setTexts((prev) => prev.filter((o) => o.id !== id));
    setSelectedId(null);
  }
  function setColor(id: number, color: string) {
    setTexts((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)));
  }
  function resize(id: number, delta: number) {
    setTexts((prev) => prev.map((o) => (o.id === id ? { ...o, sizeCqh: Math.max(2, Math.min(14, o.sizeCqh + delta)) } : o)));
  }

  function startDrag(e: React.PointerEvent, o: PageTextObj) {
    e.stopPropagation();
    const wasSel = selectedId === o.id;
    setSelectedId(o.id);
    drag.current = { id: o.id, sx: e.clientX, sy: e.clientY, ofx: o.fx, ofy: o.fy, moved: false, wasSel };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveDrag(e: React.PointerEvent, id: number) {
    if (!drag.current || drag.current.id !== id) return;
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dfx = (e.clientX - drag.current.sx) / rect.width;
    const dfy = (e.clientY - drag.current.sy) / rect.height;
    if (!drag.current.moved && (Math.abs(dfx) > 0.004 || Math.abs(dfy) > 0.004)) {
      drag.current.moved = true;
      pushHistory();
    }
    setTexts((prev) =>
      prev.map((o) => (o.id === id ? { ...o, fx: drag.current!.ofx + dfx, fy: drag.current!.ofy + dfy } : o)),
    );
  }
  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.wasSel) {
      const o = texts.find((x) => x.id === d.id);
      if (o) editText(o);
    }
  }

  function clearAll() {
    pushHistory();
    const c = strokesRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    if (drawKey) {
      localStorage.removeItem(drawKey);
      pushField(drawKey, 'strokes', null);
    }
    setTexts([]);
    setSelectedId(null);
  }

  const hasAnnotations = texts.length > 0; // (Striche separat; für Sperren nicht mehr nötig)

  return {
    texts,
    selectedId,
    setSelectedId,
    pending,
    canUndo,
    canRedo,
    hasAnnotations,
    pushHistory,
    saveStrokes,
    undo,
    redo,
    placeText,
    confirmText,
    cancelText,
    editText,
    deleteText,
    setColor,
    resize,
    startDrag,
    moveDrag,
    endDrag,
    clearAll,
  };
}
