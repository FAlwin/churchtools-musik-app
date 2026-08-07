import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useZoomPersistence, type ZoomState } from './useZoomPersistence';
import { useLatestRef } from './useLatestRef';

interface UseZoomOrchestrationParams {
  /** Basis-Schlüssel für den gespeicherten Zoom einer Seite (ohne Layout-Suffix). */
  zoomKeyBaseFor: (page: number) => string;
  pageIndex: number;
  /** 1 (Hochformat) oder 2 (Querformat). */
  perView: number;
  /** Nur zur Erkennung eines HINTERGRUND-Neuaufbaus (neues Array = Seiten wurden neu gerendert). */
  pages: HTMLCanvasElement[];
  loading: boolean;
  /** Erhöht sich nach einem Server-Sync → gespeicherten Zoom neu anwenden. */
  syncTick: number;
  /** Die Zoom-Ebenen der beiden sichtbaren Slots. */
  transformRefs: MutableRefObject<ReactZoomPanPinchRef | null>[];
  /** Meldet nach oben, ob eine sichtbare Seite reingezoomt ist (Reset-Knopf der Kopfleiste). */
  onZoomedChange?: (zoomed: boolean) => void;
  /** Erhöht sich, wenn der Reset-Knopf gedrückt wurde. */
  resetZoomSignal: number;
  /**
   * Signal „nur einpassen" (#319): Beim Aus-/Einblenden der Leisten ändert sich die Höhe der
   * Anzeigefläche. Anders als `resetZoomSignal` bleibt ein gespeicherter Zoom dabei erhalten – der
   * Nutzer hat ihn nicht zurückgenommen, sondern nur die Leisten umgeschaltet.
   */
  fitZoomSignal?: number;
}

/** Die Zoom-bezogenen Eigenschaften einer `TransformWrapper`-Ebene. */
interface ZoomPaneProps {
  onInit: (ref: ReactZoomPanPinchRef) => void;
  onZoomStart: () => void;
  onZoomStop: () => void;
  onTransformed: (ref: ReactZoomPanPinchRef, state: { scale: number }) => void;
}

/**
 * Alles rund um den Pinch-Zoom der sichtbaren Seiten an EINER Stelle (#193).
 *
 * Vorher lag das über `PageDeck` verstreut: drei Refs, vier Wiederherstell-Effekte und vier
 * Gesten-Callbacks mitten im JSX. Genau diese Verteilung hat mehrere Reparatur-Runden gekostet,
 * weil der Lebenslauf von `gestureSlot` (Gesten-Start → Gesten-Ende + 350 ms) nur im
 * Zusammenspiel aller Teile stimmt.
 *
 * **Die Regel, um die sich alles dreht:** Solange eine echte Nutzer-Geste läuft, darf nichts
 * Programmatisches dazwischenfunken – weder speichern (sonst wird der geladene Wert quer über
 * Lieder zurückgeschrieben) noch löschen (sonst wischt ein programmatisches Zurücksetzen den
 * gespeicherten Zoom weg) noch wiederherstellen (sonst bricht der laufende Pinch ab, #33).
 * `gestureSlot` ist deshalb eine Ref und keine State-Variable: Schon das ERSTE `onTransformed`
 * einer Geste muss den richtigen Slot sehen.
 *
 * Wird `gestureSlot` am Ende nicht freigegeben, „bleibt der Zoom nicht" – deshalb die verzögerte
 * Freigabe in `onZoomStop`: Die Ausricht-Animation der Bibliothek läuft nach dem Loslassen noch
 * ~200 ms und soll den ENDWERT speichern.
 */
export function useZoomOrchestration({
  zoomKeyBaseFor,
  pageIndex,
  perView,
  pages,
  loading,
  syncTick,
  transformRefs,
  onZoomedChange,
  resetZoomSignal,
  fitZoomSignal = 0,
}: UseZoomOrchestrationParams) {
  // Letzter Zoom-Faktor je Slot – um „aktives Herauszoomen" von programmatischem Reset zu unterscheiden.
  const lastScale = useRef<[number, number]>([1, 1]);
  const gestureSlot = useRef<number | null>(null);
  const gestureEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Welche sichtbaren Seiten gerade reingezoomt sind (auch geladener Zoom) → steuert
  // Wisch-Navigation und den Zoom-Reset-Knopf.
  const [zoomedSlots, setZoomedSlots] = useState<[boolean, boolean]>([false, false]);

  const zoom = useZoomPersistence({
    zoomKeyBaseFor,
    perView,
    pageIndex,
    transformRefs,
    lastScale,
    gestureSlot,
    zoomedSlots,
  });
  // Die Funktionen entstehen je Render neu (sie hängen an `zoomKeyBaseFor`, das der Aufrufer inline
  // erzeugt). In einer Ref dürfen die Effekte sie aufrufen, ohne ihre Abhängigkeitsliste zu
  // verfälschen – das war einer der Gründe für die abgeschalteten Hook-Prüfungen.
  const zoomRef = useLatestRef(zoom);

  // Beim Blättern/Drehen den Gesten-Zustand zurücksetzen. Das eigentliche Wiederherstellen passiert
  // VERZÖGERUNGSFREI in `onInit` jeder Zoom-Ebene (die per Seiten-key neu aufgebaut wird) – onInit
  // feuert genau dann, wenn die Ebene vermessen ist. Dieser Effekt ist nur noch Absicherung.
  useEffect(() => {
    if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
    gestureSlot.current = null;
    lastScale.current = [1, 1]; // Merker der Vorseite verwerfen (sonst löscht ein Mini-Pinch fälschlich)
    if (loading) return;
    requestAnimationFrame(() => zoomRef.current.restoreVisibleZoom({ fitUnsaved: true }));
  }, [pageIndex, perView, loading, zoomRef]);

  // Gesten-Ende-Timer beim Unmount aufräumen.
  useEffect(
    () => () => {
      if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
    },
    [],
  );

  // Nach einem HINTERGRUND-Neuaufbau der Seiten (neues pages-Array, z. B. Transponieren/Spalten/
  // Version oder 30-Sekunden-Sync) den gespeicherten Zoom je sichtbarer Seite ERNEUT anwenden.
  // Sonst geht ein per Pinch gesetzter Zoom beim Neu-Zeichnen der Canvas verloren, obwohl er im
  // Speicher steht. Setzt NIE auf Fit zurück (fitUnsaved:false) – es ist dasselbe Layout.
  const pagesSeen = useRef(pages);
  useEffect(() => {
    if (pages === pagesSeen.current) return;
    pagesSeen.current = pages;
    if (loading) return;
    requestAnimationFrame(() => zoomRef.current.restoreVisibleZoom({ fitUnsaved: false }));
  }, [pages, loading, zoomRef]);

  // Nach App-Rückkehr / Anmerkungs-Sync / Editor-Schließen (syncTick) neu AUSRICHTEN: gespeicherter
  // Zoom → anwenden; kein gespeicherter, aber hängengebliebener Zoom → auf Fit. So löst sich auch
  // eine „steckende" Seite nach Editor-Rückkehr.
  const syncSeen = useRef(syncTick);
  useEffect(() => {
    if (syncTick === syncSeen.current) return;
    syncSeen.current = syncTick;
    requestAnimationFrame(() => zoomRef.current.restoreVisibleZoom({ fitUnsaved: true }));
  }, [syncTick, zoomRef]);

  // „Ist reingezoomt?" nach oben melden – steuert den Reset-Knopf in der Kopfleiste (ChordChart).
  const anyZoomed = zoomedSlots.slice(0, perView).some(Boolean);
  useEffect(() => {
    onZoomedChange?.(anyZoomed);
  }, [anyZoomed, onZoomedChange]);

  // Reset-Knopf der Kopfleiste gedrückt (Signal erhöht) → sichtbaren Zoom zurücksetzen.
  const lastResetSignal = useRef(resetZoomSignal);
  useEffect(() => {
    if (resetZoomSignal === lastResetSignal.current) return;
    lastResetSignal.current = resetZoomSignal;
    zoomRef.current.resetVisibleZoom();
  }, [resetZoomSignal, zoomRef]);

  // Nur einpassen, nichts löschen (#319 – Leisten umgeschaltet, die Fläche hat eine neue Höhe).
  // Ein rAF dazwischen, damit die neue Höhe schon im Layout steht, bevor eingepasst wird.
  const lastFitSignal = useRef(fitZoomSignal);
  useEffect(() => {
    if (fitZoomSignal === lastFitSignal.current) return;
    lastFitSignal.current = fitZoomSignal;
    requestAnimationFrame(() => zoomRef.current.fitVisibleZoom());
  }, [fitZoomSignal, zoomRef]);

  /** Zoom-Eigenschaften der Ebene für Slot `j`. */
  function paneProps(j: number): ZoomPaneProps {
    return {
      // Gespeicherten Zoom SOFORT anwenden, sobald die Ebene vermessen ist (kein Warten auf einen
      // späteren Effekt → keine sichtbare Verzögerung nach dem Blättern).
      onInit: (ref) => {
        if (gestureSlot.current === j) return;
        const saved = zoom.loadZoom(pageIndex + j);
        if (saved) ref.setTransform(saved.x, saved.y, saved.scale, 0);
      },
      // Synchron am Gesten-Start setzen (Pinch löst onZoomStart aus, auch beim reinen
      // Zwei-Finger-Verschieben) → schon das erste onTransformed sichert korrekt.
      onZoomStart: () => {
        if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
        gestureSlot.current = j;
      },
      // Verzögert freigeben – die Ausricht-Animation läuft nach dem Loslassen noch ~200 ms und soll
      // den ENDWERT speichern. Danach dürfen die Wiederherstell-Effekte diesen Slot wieder bedienen.
      onZoomStop: () => {
        if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
        gestureEndTimer.current = setTimeout(() => {
          gestureSlot.current = null;
        }, 350);
      },
      onTransformed: (_ref, state) => {
        zoom.persistZoom(j);
        const z = state.scale > 1.01;
        setZoomedSlots((prev) => {
          if (prev[j] === z) return prev;
          const next: [boolean, boolean] = [prev[0], prev[1]];
          next[j] = z;
          return next;
        });
      },
    };
  }

  return {
    paneProps,
    /** Gespeicherten Zoom einer Seite lesen (für den Blätter-Streifen). */
    loadZoom: (page: number): ZoomState | null => zoom.loadZoom(page),
    /** Nach dem Neuzeichnen der Canvas erneut anwenden (siehe `usePageCanvases`). */
    restoreAfterPaint: () => zoomRef.current.restoreVisibleZoom({ fitUnsaved: true }),
  };
}
