/**
 * Transponier-Logik für Akkorde und Tonarten.
 * Reine Funktionen, keine React-Abhängigkeit. Übernommen aus dem Design-Prototyp
 * und um Typen/Doku ergänzt.
 */

const CHROM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** b-Tonarten auf Halbton-Index abbilden (Db = C#, …). */
const FLATMAP: Record<string, number> = {
  Db: 1,
  Eb: 3,
  Fb: 4,
  Gb: 6,
  Ab: 8,
  Bb: 10,
  Cb: 11,
};

/** Halbtöne, die bei b-Darstellung als b geschrieben werden. */
const FLATSET = new Set([1, 3, 6, 8, 10]);

/** Notenname → Halbton-Index (0–11). -1, wenn unbekannt. */
function noteToIndex(note: string): number {
  const i = CHROM.indexOf(note as (typeof CHROM)[number]);
  return i !== -1 ? i : (FLATMAP[note] ?? -1);
}

/** Halbton-Index → Notenname. `flat` wählt b-Schreibweise. */
function indexToNote(index: number, flat: boolean): string {
  const n = ((index % 12) + 12) % 12;
  if (flat && FLATSET.has(n)) {
    return { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' }[n] as string;
  }
  return CHROM[n];
}

/**
 * Transponiert einen einzelnen Akkord um `semitones` Halbtöne.
 * Erhält Suffixe (m7, sus4 …) und Bass-Töne (E/G# → beide transponiert).
 */
export function transposeChord(chord: string, semitones: number, flat = false): string {
  if (!chord || !chord.trim()) return chord;
  // Optionale Akkorde in Klammern (SongSelect-Dialekt): (E) → Inneres transponieren
  const paren = chord.match(/^\((.+)\)$/);
  if (paren) return '(' + transposeChord(paren[1], semitones, flat) + ')';
  if (semitones === 0) return chord;
  const m = chord.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const rootIndex = noteToIndex(m[1]);
  if (rootIndex === -1) return chord;
  const bass = m[3] ? '/' + indexToNote(noteToIndex(m[3]) + semitones, flat) : '';
  return indexToNote(rootIndex + semitones, flat) + m[2] + bass;
}

/** Halbton-Differenz von Ausgangs- zu Zieltonart (0–11). */
export function getSemitoneOffset(fromKey: string, toKey: string): number {
  const a = noteToIndex(fromKey.replace('m', ''));
  const b = noteToIndex(toKey.replace('m', ''));
  return a === -1 || b === -1 ? 0 : (b - a + 12) % 12;
}

/** Verschiebt eine Tonart (inkl. Dur/Moll-Erhalt) um `semitones`. */
export function shiftKey(key: string, semitones: number): string {
  const isMinor = key.endsWith('m');
  const base = noteToIndex(key.replace('m', ''));
  if (base === -1) return key;
  return indexToNote(base + semitones, false) + (isMinor ? 'm' : '');
}

export const ALL_KEYS_MAJOR = [...CHROM];
export const ALL_KEYS_MINOR = CHROM.map((k) => k + 'm');
