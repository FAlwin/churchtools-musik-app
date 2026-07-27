import { useEffect, useState } from 'react';

/** Ist das Gerät gerade im Querformat? */
export function isLandscape(): boolean {
  // matchMedia('orientation') ist beim Screen-Wechsel/SPA-Navigation stabiler als
  // innerWidth/Height (die kurzzeitig falsch gemeldet werden) → verhindert, dass abgeleitete
  // Werte kippen (z. B. der Zoom-Schlüssel in PageDeck, der das Layout enthält).
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function')
    return window.matchMedia('(orientation: landscape)').matches;
  return window.innerWidth > window.innerHeight;
}

/**
 * Ausrichtung des Geräts, laufend nachgeführt (#215).
 *
 * Der Block stand dreimal fast gleich im Code (`PageDeck`, `ChordChart`, `useChartNavigation`) –
 * mit unterschiedlichem Umfang: Nur die Fassung in `PageDeck` prüfte die Ausrichtung auch bei
 * `focus`/`pageshow`/`visibilitychange` nach. Das ist die vollständigere und gilt jetzt überall:
 * Kommt eine iOS-PWA aus dem Hintergrund zurück, kann sich die Ausrichtung geändert haben, ohne
 * dass je ein `resize` ankam.
 *
 * Bewusst NICHT enthalten: das Hochzählen der Remount-Epoche in `PageDeck`. Das hängt am
 * Sichtbarkeitswechsel, nicht an der Ausrichtung, und bleibt dort.
 */
export function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(isLandscape);

  useEffect(() => {
    const check = () => setLandscape(isLandscape());
    // `focus` ist billig mitzunehmen, feuert am Desktop aber bei jedem Tab-Wechsel – deshalb
    // hängt hier ausschließlich die Ausrichtungsprüfung dran, nichts Teures.
    const events: [EventTarget, string][] = [
      [window, 'resize'],
      [window, 'orientationchange'],
      [window, 'focus'],
      [window, 'pageshow'],
      [document, 'visibilitychange'],
    ];
    for (const [target, name] of events) target.addEventListener(name, check);
    return () => {
      for (const [target, name] of events) target.removeEventListener(name, check);
    };
  }, []);

  return landscape;
}
