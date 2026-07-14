import { describe, it, expect } from 'vitest';
import { shouldReloadAfterChunkError, RELOAD_COOLDOWN_MS } from './chunkReload';

/** Minimaler In-Memory-Ersatz für sessionStorage (nur die genutzten Methoden). */
function fakeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('shouldReloadAfterChunkError (#151 – Reload nach veraltetem Chunk, Schleifenschutz)', () => {
  it('erster Chunk-Fehler → Reload erlaubt und Zeitpunkt gemerkt', () => {
    const storage = fakeStorage();
    expect(shouldReloadAfterChunkError(1_000_000, storage)).toBe(true);
  });

  it('zweiter Fehler innerhalb des Cooldowns → KEIN Reload (verhindert Endlosschleife)', () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;
    expect(shouldReloadAfterChunkError(t0, storage)).toBe(true);
    expect(shouldReloadAfterChunkError(t0 + RELOAD_COOLDOWN_MS, storage)).toBe(false);
    expect(shouldReloadAfterChunkError(t0 + 1, storage)).toBe(false);
  });

  it('erneuter Fehler NACH dem Cooldown (späterer Deploy) → wieder Reload erlaubt', () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;
    expect(shouldReloadAfterChunkError(t0, storage)).toBe(true);
    expect(shouldReloadAfterChunkError(t0 + RELOAD_COOLDOWN_MS + 1, storage)).toBe(true);
  });
});
