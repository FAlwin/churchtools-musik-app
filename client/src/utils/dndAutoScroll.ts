/**
 * Zähmt den dnd-kit-AutoScroll für iOS-PWA (#56): Beim Ziehen mit Auto-Scroll scrollte dnd-kit
 * neben dem inneren `.scroll`-Container auch das DOKUMENT (html/body haben zwar overflow:hidden,
 * per JS ist scrollTop trotzdem setzbar). Die absolut positionierte `.screen` samt Kopfleiste
 * wanderte dadurch nach oben aus dem Bild und war nicht mehr erreichbar – nur ein Wechsel
 * Quer-/Hochformat (der `--app-h` neu setzt) holte sie zurück.
 */

/** AutoScroll nur für innere Scroll-Container erlauben – nie fürs Dokument selbst. */
export const innerScrollOnly = {
  canScroll: (element: Element): boolean =>
    element !== document.scrollingElement &&
    element !== document.documentElement &&
    element !== document.body,
};

/**
 * Nach dem Ziehen einen evtl. doch verschobenen Dokument-Scroll zurücksetzen und `--app-h`
 * neu setzen (der Resize-Event stößt `syncAppHeight` in main.tsx an) – automatisiert, was
 * bisher nur das manuelle Drehen des Geräts bewirkte.
 */
export function resetViewportAfterDrag(): void {
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event('resize'));
}
