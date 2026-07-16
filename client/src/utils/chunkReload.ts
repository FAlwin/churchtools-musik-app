/**
 * Umgang mit veralteten Lazy-Chunks nach einem Deploy (#151).
 *
 * Nach einem Release zeigt die noch laufende (alte) index.html auf inzwischen entfernte
 * Chunk-Dateien. Öffnet der Nutzer dann erstmals eine noch nicht geladene Seite, schlägt das
 * dynamische `import()` fehl. Statt in den generischen Startfehler (ErrorBoundary) zu kippen,
 * lädt die App EINMAL neu und holt die frische index.html samt neuer Chunk-URLs.
 */

const RELOAD_KEY = 'chunkReloadAt';
/** Zwei Chunk-Fehler innerhalb dieser Spanne lösen NUR EINEN Reload aus (Schleifenschutz). */
export const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Rein & testbar: Darf jetzt ein Auto-Reload wegen eines Chunk-Fehlers ausgelöst werden?
 * Merkt sich den Zeitpunkt in `storage`. Liegt der letzte Auto-Reload weniger als
 * {@link RELOAD_COOLDOWN_MS} zurück, wird NICHT erneut geladen – sonst entstünde bei einem
 * wirklich dauerhaft fehlenden Chunk eine Endlosschleife. Ein späterer Deploy (nach dem
 * Cooldown) darf wieder neu laden.
 */
export function shouldReloadAfterChunkError(
  now: number = Date.now(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): boolean {
  const last = Number(storage.getItem(RELOAD_KEY) ?? '0');
  if (now - last > RELOAD_COOLDOWN_MS) {
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  }
  return false;
}

/**
 * Erkennt einen fehlgeschlagenen dynamischen Chunk-Import. Die Meldung unterscheidet sich je
 * Browser/Bundler („Failed to fetch dynamically imported module", „Importing a module script
 * failed", „ChunkLoadError", „Loading chunk … failed") → wir prüfen auf die gängigen Fragmente.
 */
export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const s = `${e?.name ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return (
    s.includes('dynamically imported module') ||
    s.includes('importing a module script failed') ||
    s.includes('chunkloaderror') ||
    s.includes('loading chunk') ||
    (s.includes('failed to fetch') && s.includes('module'))
  );
}

/**
 * Umschließt die dynamische Import-Funktion einer Lazy-Seite. Bei einem Chunk-Ladefehler wird
 * die App einmalig neu geladen (siehe {@link shouldReloadAfterChunkError}); schlägt es auch nach
 * dem Reload fehl, wird der Fehler durchgereicht → die ErrorBoundary zeigt eine Meldung.
 * Rein Promise-transformierend (kein Komponenten-Typ) → `lazy()` infert den Seitentyp wie gehabt.
 */
export function withChunkReload<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch((err: unknown) => {
      if (shouldReloadAfterChunkError()) {
        window.location.reload();
        return new Promise<T>(() => {}); // hält den Suspense-Fallback, bis der Reload greift
      }
      throw err;
    });
}
