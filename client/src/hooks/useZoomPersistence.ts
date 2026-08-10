import type { MutableRefObject } from 'react';
import { diag } from '../utils/diagnose';
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
        // `JSON.parse` liefert `any` – erst prüfen, dann als ZoomState behandeln (#279).
        const parsed = JSON.parse(s) as Partial<ZoomState> | null;
        if (parsed && typeof parsed.scale === 'number') return parsed as ZoomState;
      }
    } catch {
      /* ignorieren */
    }
    return null;
  }

  /**
   * Gespeicherten Zoom einer Seite dauerhaft löschen – lokal UND auf dem Konto (#283).
   *
   * Vorher war die Regel halb umgesetzt: Lokal wurden beide Schlüssel entfernt (der aktuelle
   * Layout-Schlüssel und der alte Basis-Schlüssel als Rückfall), dem Server aber nur der
   * Layout-Schlüssel gemeldet. Der Alt-Eintrag blieb damit für immer in der Kontodatei und kam bei
   * jedem Abgleich zurück – „gelöscht" hielt also nur bis zum nächsten Öffnen auf einem Gerät, das
   * noch den alten Schlüssel kannte.
   */
  function clearStoredZoom(page: number) {
    for (const k of [zoomKeyFor(page), zoomKeyBaseFor(page)]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignorieren */
      }
      pushField(k, 'zoom', null); // beide Schlüssel auch auf dem Konto abräumen
    }
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
   * Sichtbare Seiten einpassen, OHNE den gespeicherten Zoom zu vergessen (#319).
   *
   * Gebraucht, wenn sich die verfügbare FLÄCHE ändert (Leisten aus-/einblenden): Eine vergrößerte
   * Seite ragt sonst hinter die Leisten. Zwei Unterschiede zu `resetVisibleZoom`, beide wichtig:
   *
   *  - **Der Speicher bleibt.** Der Nutzer hat den Zoom nicht zurückgenommen, er hat nur die
   *    Leisten umgeschaltet; beim nächsten Blättern auf die Seite kommt er zurück.
   *  - **Kein `zoomedSlots`-Vorbehalt.** Der Merker wird in `onTransformed` gepflegt und kann in
   *    genau diesem Moment veraltet sein – dann passierte gar nichts, und das war der gemeldete
   *    Fehler. Auf einer nicht vergrößerten Seite ist `resetTransform` ohnehin wirkungslos.
   *
   * **Und auch kein `gestureSlot`-Vorbehalt** – anders als bei den Wiederherstell-Effekten. Der
   * Grund für die Sperre (#33) ist „einen LAUFENDEN Pinch nicht abwürgen"; hier kann gar keiner
   * laufen: Ausgelöst wird das Einpassen ausschließlich vom Tipp in die Mitte, und ein Tipp mit
   * einem Finger und ein Pinch mit zweien schließen sich aus. Gemessen ist die Sperre nach dem
   * Zoomen aber noch **rund eine halbe Sekunde** gesetzt (`onZoomStop` kommt ~200 ms nach dem
   * letzten Rad-/Finger-Ereignis, dazu 350 ms Nachlauf) – wer direkt nach dem Vergrößern in die
   * Mitte tippte, bekam deshalb gar kein Einpassen. Genau der gemeldete Fall. Die Sperre wird
   * hier stattdessen freigegeben: Der Tipp hat die Geste beendet.
   */
  function fitVisibleZoom() {
    gestureSlot.current = null;
    for (let j = 0; j < perView; j++) {
      diag(
        `    fit Slot ${j}: Ebene ${transformRefs[j].current ? 'da' : 'FEHLT'}, Skala vorher ${
          transformRefs[j].current?.instance?.transformState?.scale ?? '?'
        }`,
      );
      // `setTransform(0, 0, 1, 0)` statt `resetTransform(150)`: gemessen blieb der Zoom bei
      // `resetTransform` **unverändert** stehen (1,96 vorher wie nachher). Die Bibliothek fährt den
      // Wert über eine Animation zurück – und genau in diesem Moment ändert sich die Größe der
      // Fläche, was die laufende Animation verwirft. Ohne Animation gibt es nichts zu verwerfen.
      transformRefs[j].current?.setTransform(0, 0, 1, 0);
    }
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
      diag(`    restore Slot ${j}: gespeichert ${saved ? String(saved.scale) : 'nein'}`);
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
    fitVisibleZoom,
    restoreVisibleZoom,
  };
}
