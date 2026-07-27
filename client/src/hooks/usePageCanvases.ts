import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useLatestRef } from './useLatestRef';

type CanvasRefs = MutableRefObject<HTMLCanvasElement | null>[];

interface UsePageCanvasesParams {
  /** Fertig gerenderte Seiten (offscreen-Canvas) des gesamten Stroms. */
  pages: HTMLCanvasElement[];
  /** Index der linken sichtbaren Seite. */
  pageIndex: number;
  /** 1 (Hochformat) oder 2 (Querformat). */
  perView: number;
  loading: boolean;
  /** Erhöht sich nach einem Server-Sync → Striche neu aus localStorage laden. */
  syncTick: number;
  /** Erhöht sich nach einem erzwungenen Remount der Zoom-Ebenen → Canvas-Elemente sind neu. */
  remountEpoch: number;
  /**
   * WIRKSAMER Anmerkungs-Schlüssel je sichtbarem Slot (`null` = nichts zeichnen). Der Aufrufer hat
   * „Ansehen ohne Vorschau" hier schon eingerechnet. **Muss stabile Identität haben** (useMemo über
   * `joinKeys`) – steckt in den Abhängigkeiten.
   */
  ownKeys: (string | null)[];
  /** Schlüssel der schreibgeschützten fremden Ebene je Slot. Ebenfalls stabile Identität. */
  overKeys: (string | null)[];
  /** Wirksame Schlüssel der NACHBAR-Seiten (Vorrat für den Slide-Streifen). Stabile Identität. */
  neighbourKeys: (string | null)[];
  /** Canvas der Seite selbst (Akkorde/PDF). */
  contentRefs: CanvasRefs;
  /** Interaktive Anmerkungs-Canvas (eigene Striche). */
  annoRefs: CanvasRefs;
  /** Canvas der fremden Ebene (nur lesend, liegt unter der interaktiven). */
  overlayRefs: CanvasRefs;
  /** Läuft nach dem Neuzeichnen – stellt den gespeicherten Zoom wieder her. Darf instabil sein. */
  onAfterPaint: () => void;
}

/**
 * Malt die sichtbaren Seiten samt Anmerkungs-Ebenen und hält die Strich-Bilder der Nachbarseiten
 * vorrätig (#193 – vorher zwei Effekte mitten in `PageDeck`).
 *
 * Beide Effekte hängen an den **Schlüsseln** der Seiten, nicht mehr an den Schlüssel-*Funktionen*
 * (Begründung in `utils/pageKeys.ts`). Dadurch kommt dieser Hook ohne ein einziges
 * `exhaustive-deps`-Disable aus – und zeichnet jetzt auch dann neu, wenn sich ein Schlüssel ohne
 * Seiten-/Sync-Wechsel ändert.
 *
 * Gibt das Seitenverhältnis je Slot (für die Text-Ebene) und den Bild-Vorrat zurück.
 */
export function usePageCanvases({
  pages,
  pageIndex,
  perView,
  loading,
  syncTick,
  remountEpoch,
  ownKeys,
  overKeys,
  neighbourKeys,
  contentRefs,
  annoRefs,
  overlayRefs,
  onAfterPaint,
}: UsePageCanvasesParams) {
  const [aspects, setAspects] = useState<string[]>(['210 / 297', '210 / 297']);
  // Vorab dekodierte Strich-Bilder (localStorage-PNGs) der Umgebung.
  const strokeImgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const afterPaint = useLatestRef(onAfterPaint);

  // Sichtbare Seiten malen + Striche laden + Seitenverhältnis setzen.
  useEffect(() => {
    if (loading) return;
    const nextAspects: string[] = [];
    for (let j = 0; j < perView; j++) {
      const content = contentRefs[j].current;
      const anno = annoRefs[j].current;
      if (!content || !anno) continue;
      const src = pages[pageIndex + j];
      if (!src) continue;
      content.width = src.width;
      content.height = src.height;
      content.getContext('2d')!.drawImage(src, 0, 0);
      anno.width = src.width;
      anno.height = src.height;
      const ctx = anno.getContext('2d')!;
      ctx.clearRect(0, 0, anno.width, anno.height);
      const saved = ownKeys[j] ? localStorage.getItem(ownKeys[j]!) : null;
      if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
      // Overlay-Striche (fremde Ebene, nur lesend) auf die eigene Canvas darunter.
      const over = overlayRefs[j].current;
      if (over) {
        over.width = src.width;
        over.height = src.height;
        const octx = over.getContext('2d')!;
        octx.clearRect(0, 0, over.width, over.height);
        const oSaved = overKeys[j] ? localStorage.getItem(overKeys[j]!) : null;
        if (oSaved) {
          const img = new Image();
          img.onload = () => octx.drawImage(img, 0, 0);
          img.src = oSaved;
        }
      }
      nextAspects[j] = `${src.width} / ${src.height}`;
    }
    // Funktionales Update: der vorige `aspects`-Stand wird NICHT gelesen → keine implizite
    // Abhängigkeit (fehlende Indizes bleiben unverändert, damit nur die sichtbaren Slots wechseln).
    // Bei gleichem Ergebnis wird `prev` UNVERÄNDERT zurückgegeben – sonst entstünde bei jedem Lauf
    // ein neues Array und damit ein zusätzlicher Render. Bekäme dieser Hook einmal ein instabiles
    // `ownKeys` (etwa weil jemand das `useMemo` im Aufrufer vergisst), wäre daraus eine
    // Endlosschleife geworden: Effekt → neuer State → Render → Effekt. Genau das ist beim Schreiben
    // der Tests passiert.
    setAspects((prev) => {
      const next = prev.map((a, j) => nextAspects[j] ?? a);
      return next.every((a, j) => a === prev[j]) ? prev : next;
    });
    // Gespeicherten Zoom NACH dem Neuzeichnen erneut anwenden: das Setzen der Canvas-Maße löst in
    // der Zoom-Bibliothek eine Neuvermessung aus (ResizeObserver → Neuausrichtung Richtung Mitte),
    // die den in onInit gesetzten Zoom überschreiben kann. Doppel-rAF liegt sicher NACH dieser
    // Neuausrichtung; das 250-ms-Netz fängt Nachzügler (z. B. Ausricht-Animationen). Ohne das
    // sprang die Seite nach dem Blättern zurück in die Mitte, bis der nächste Sync sie rettete.
    const applySaved = () => afterPaint.current();
    requestAnimationFrame(() => requestAnimationFrame(applySaved));
    const net = window.setTimeout(applySaved, 250);
    return () => window.clearTimeout(net);
  }, [
    loading,
    pages,
    pageIndex,
    perView,
    syncTick,
    remountEpoch,
    ownKeys,
    overKeys,
    contentRefs,
    annoRefs,
    overlayRefs,
    afterPaint,
  ]);

  // Strich-Bilder der Nachbarseiten vorab dekodieren → der Slide-Streifen kann sie beim Blättern
  // SOFORT (synchron) mitzeichnen, ohne auf das Dekodieren zu warten.
  useEffect(() => {
    if (loading) return;
    for (const key of neighbourKeys) {
      if (!key) continue;
      const data = localStorage.getItem(key);
      if (!data) {
        strokeImgCache.current.delete(key);
        continue;
      }
      const cached = strokeImgCache.current.get(key);
      if (cached && cached.src === data) continue;
      const img = new Image();
      img.src = data;
      strokeImgCache.current.set(key, img);
    }
    // Vorrat klein halten (älteste Einträge zuerst raus – Map behält die Einfüge-Reihenfolge).
    while (strokeImgCache.current.size > 40) {
      const oldest = strokeImgCache.current.keys().next().value;
      if (oldest === undefined) break;
      strokeImgCache.current.delete(oldest);
    }
  }, [loading, syncTick, neighbourKeys]);

  return { aspects, strokeImgCache };
}
