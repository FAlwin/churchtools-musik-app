import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { pushField } from '../services/annotations';
import { deviceClass } from '../utils/deviceClass';

export interface ZoomState {
  x: number;
  y: number;
  scale: number;
}

interface UseZoomPersistenceParams {
  /** Basis-Schlüssel für den gespeicherten Zoom einer Seite (ohne Layout-Suffix). */
  zoomKeyBaseFor: (page: number) => string;
  /** Sichtbare Seiten je Ansicht (1 Hochformat / 2 Querformat). */
  perView: number;
  /** Index der ersten sichtbaren Seite. */
  pageIndex: number;
  /** Transform-Refs der sichtbaren Zoom-Ebenen (je Slot). */
  transformRefs: MutableRefObject<ReactZoomPanPinchRef | null>[];
  /** Letzter Zoom-Faktor je Slot (Nutzer-Herauszoomen ↔ programmatischer Reset). */
  lastScale: MutableRefObject<[number, number]>;
  /** Slot einer laufenden Pinch-/Pan-Geste (nur echte Gesten werden gesichert). */
  gestureSlot: MutableRefObject<number | null>;
  /** Welche sichtbaren Slots gerade reingezoomt sind. */
  zoomedSlots: [boolean, boolean];
}

/**
 * Kapselt das dauerhafte Speichern/Laden des Pinch-Zooms pro Seite.
 *
 * Der Zoom hängt an der Bildschirm-Geometrie → Geräteklasse UND Layout (1-spaltig
 * Hochformat / 2-spaltig Querformat) stecken im Schlüssel. Sonst würde ein im
 * Hochformat gespeicherter Pixel-Ausschnitt im Querformat (halbe Breite, 2 Seiten)
 * angewendet und die Seite „einfrieren" (#33).
 *
 * Bewusst NICHT memoisiert: die Funktionen werden je Render neu erzeugt (wie zuvor
 * als innere Funktionen in PageDeck) und in Effekten mit `exhaustive-deps`-Disable
 * verwendet – Verhalten unverändert, nur zentralisiert.
 */
export function useZoomPersistence({
  zoomKeyBaseFor,
  perView,
  pageIndex,
  transformRefs,
  lastScale,
  gestureSlot,
  zoomedSlots,
}: UseZoomPersistenceParams) {
  const zoomKeyFor = (page: number): string =>
    `${zoomKeyBaseFor(page)}_d${deviceClass()}${perView}`;

  function loadZoom(page: number): ZoomState | null {
    try {
      const s = localStorage.getItem(zoomKeyFor(page));
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed.scale === 'number') return parsed;
      }
    } catch {
      /* ignorieren */
    }
    return null;
  }

  // Gespeicherten Zoom einer Seite dauerhaft löschen (aktueller Layout-Schlüssel + Basis als Fallback).
  function clearStoredZoom(page: number) {
    for (const k of [zoomKeyFor(page), zoomKeyBaseFor(page)]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignorieren */
      }
    }
    pushField(zoomKeyFor(page), 'zoom', null);
  }

  // Zoom/Ausschnitt einer sichtbaren Seite automatisch sichern, sobald eine Geste endet (#33).
  // So bleibt ein freier Pinch-Zoom auch ohne „Fertig" erhalten – über die Sitzung und nach
  // Neuöffnen. Bei Rückkehr auf Fit (scale ≈ 1) wird der gespeicherte Zoom wieder entfernt.
  function persistZoom(slot: number) {
    // Nur echte Nutzer-Gesten sichern (beim Pinch/Pan hält gestureSlot diesen Slot) – NICHT das
    // programmatische Wiederherstellen, sonst wird der gerade geladene Wert quer über Lieder
    // zurückgeschrieben („bei allen Liedern gleich"). gestureSlot ist eine Ref → schon das ERSTE
    // onTransformed der Geste sieht den korrekten Slot (kein State-Timing-Loch).
    if (gestureSlot.current !== slot) return;
    const t = transformRefs[slot].current?.instance?.transformState;
    if (!t) return;
    const page = pageIndex + slot;
    if (t.scale > 1.01) {
      const zoom = { x: t.positionX, y: t.positionY, scale: t.scale };
      const zk = zoomKeyFor(page);
      try {
        localStorage.setItem(zk, JSON.stringify(zoom));
      } catch {
        /* Speicher voll */
      }
      pushField(zk, 'zoom', zoom);
    } else if (lastScale.current[slot] > 1.01) {
      // Nur löschen, wenn der Nutzer AKTIV wieder auf Fit herausgezoomt hat – nicht beim
      // programmatischen Zurücksetzen/Mounten (das würde einen gespeicherten Zoom fälschlich wipen).
      clearStoredZoom(page);
    }
    lastScale.current[slot] = t.scale;
  }

  // Notausgang: sichtbare reingezoomte Seiten auf Normalgröße zurücksetzen UND ihren Speicher löschen.
  function resetVisibleZoom() {
    for (let j = 0; j < perView; j++) {
      if (!zoomedSlots[j]) continue;
      transformRefs[j].current?.resetTransform(150);
      clearStoredZoom(pageIndex + j);
    }
    gestureSlot.current = null;
  }

  /**
   * Gespeicherten Zoom auf die aktuell sichtbaren Slots (erneut) anwenden. Ein gerade aktiv
   * bewegter Slot (`gestureSlot`) bleibt IMMER unberührt (kein laufender Pinch abbrechen, #33).
   * `fitUnsaved`: Slots ohne gespeicherten Zoom, die aber „hängengeblieben" reingezoomt sind
   * (z. B. nach Hoch-/Querformat-Wechsel = anderer Layout-Schlüssel), auf Fit zurücksetzen.
   * Ohne `fitUnsaved` (Hintergrund-Neuaufbau desselben Layouts) wird NIE auf Fit gesetzt.
   */
  function restoreVisibleZoom(opts?: { fitUnsaved?: boolean }) {
    const fitUnsaved = opts?.fitUnsaved ?? false;
    for (let j = 0; j < perView; j++) {
      if (gestureSlot.current === j) continue;
      const ref = transformRefs[j].current;
      if (!ref) continue;
      const saved = loadZoom(pageIndex + j);
      if (saved) {
        ref.setTransform(saved.x, saved.y, saved.scale, 0);
      } else if (fitUnsaved) {
        const st = ref.instance?.transformState;
        if (st && st.scale > 1.01) ref.resetTransform(0);
      }
    }
  }

  return {
    zoomKeyFor,
    loadZoom,
    persistZoom,
    clearStoredZoom,
    resetVisibleZoom,
    restoreVisibleZoom,
  };
}
