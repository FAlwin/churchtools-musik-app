/** Hilfsfunktionen rund um die Striche-Ebenen (PNG-DataURLs) der Anmerkungen. */

/**
 * Zwei Striche-PNGs (eigene + fremde) zu einem Bild zusammenführen (für den
 * Team-Notizen-Import). Fehlt eine Seite, wird die andere unverändert
 * zurückgegeben; sind beide vorhanden, werden sie deckungsgleich übereinander
 * gezeichnet. Der Canvas-Pfad braucht eine echte Browser-Leinwand – die reinen
 * null-Zweige sind separat unit-getestet (`strokes.test.ts`), das Kompositing
 * wird manuell/E2E abgedeckt.
 */
export function mergeStrokes(own: string | null, theirs: string | null): Promise<string | null> {
  if (!own) return Promise.resolve(theirs ?? null);
  if (!theirs) return Promise.resolve(own);
  return new Promise((resolve) => {
    const a = new Image();
    const b = new Image();
    let loaded = 0;
    const done = () => {
      if (++loaded < 2) return;
      const c = document.createElement('canvas');
      c.width = Math.max(a.naturalWidth, b.naturalWidth);
      c.height = Math.max(a.naturalHeight, b.naturalHeight);
      const ctx = c.getContext('2d');
      if (!ctx || !c.width || !c.height) {
        resolve(own);
        return;
      }
      ctx.drawImage(a, 0, 0);
      ctx.drawImage(b, 0, 0);
      resolve(c.toDataURL('image/png', 0.7));
    };
    a.onload = done;
    b.onload = done;
    a.onerror = done;
    b.onerror = done;
    a.src = own;
    b.src = theirs;
  });
}
