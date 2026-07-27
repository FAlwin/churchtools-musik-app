/**
 * Höhe der App als CSS-Variable `--app-h` (iOS-PWA).
 *
 * Liegt in einem eigenen Modul (#215), damit Hooks die Höhe direkt nachführen können. Vorher stand
 * die Funktion in `main.tsx`; ein Import von dort hätte beim Testen den kompletten App-Start
 * mitgezogen (React-Root mounten). Wer die Höhe neu setzen will, ruft `syncAppHeight()` – ein
 * synthetisches `resize`-Event würde nebenbei alle Resize-Handler der App auslösen.
 */
export function syncAppHeight(): void {
  // Bei geöffneter Tastatur (Eingabefeld fokussiert) NICHT mitschrumpfen: sonst reflowt die
  // GANZE App nach oben („alles verschiebt sich"). Das Freihalten des Cursors übernehmen die
  // Tastatur-Ausweich-Logiken in PageDeck/ChordEditor; nach dem Blur kommt ein Resize und
  // die Höhe wird wieder normal nachgeführt.
  const ae = document.activeElement as HTMLElement | null;
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}
