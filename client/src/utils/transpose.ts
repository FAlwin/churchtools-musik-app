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

/**
 * Transponiert einen **ganzen ChordPro-Text** um `semitones` Halbtöne (#398).
 *
 * Bis #398 gab es das nicht: Transponiert wurde nur bei der **Anzeige** (`ChordLine`, `chordPdf`),
 * der Text selbst blieb immer in seiner Tonart. Der Editor braucht es jetzt, weil er den Text in der
 * Tonart des Blatts zeigen soll – und speichert, was er zeigt.
 *
 * Zwei Dinge werden angefasst, sonst nichts:
 *  - **Akkorde in eckigen Klammern** auf Text-Zeilen – über dieselbe `transposeChord`-Regel wie die
 *    Anzeige, damit Editor und Blatt nie auseinanderlaufen (Bass-Töne, Klammer-Akkorde, Suffixe).
 *  - **Die `{key: …}`-Zeile**, falls es eine gibt. Ein Text, dessen Akkorde in D stehen und dessen
 *    Kopf „G" sagt, wäre genau die Lüge, die dieses Feature beseitigen soll.
 *
 * Direktiven-Zeilen (`{…}`) bleiben sonst unberührt: In einem `{comment: …}` steht kein Akkord.
 * Bei 0 Halbtönen kommt der Text **unverändert** zurück – kein Umschreiben von Schreibweisen.
 */
export function transposeChordpro(text: string, semitones: number, flat = false): string {
  if (semitones === 0) return text;
  return text
    .split('\n')
    .map((line) => {
      const ln = line.trim();
      if (ln.startsWith('{')) {
        // Nur die Tonart-Zeile mitziehen; alle anderen Direktiven sind kein Notentext.
        return line.replace(
          /^(\s*\{key\s*:\s*)([^}]*?)(\s*\})/i,
          (_m, vor: string, key: string, nach: string) =>
            key.trim() ? `${vor}${shiftKey(key.trim(), semitones)}${nach}` : _m,
        );
      }
      // Dieselbe Grammatik wie `parseLine`: alles in eckigen Klammern ist ein Akkord.
      return line.replace(/\[([^\]]*)\]/g, (_m, chord: string) => {
        return `[${transposeChord(chord, semitones, flat)}]`;
      });
    })
    .join('\n');
}

/**
 * Setzt die `{key: …}`-Zeile eines ChordPro-Texts – ersetzt eine vorhandene, ergänzt sonst eine.
 *
 * Gebraucht, damit eine gespeicherte Version **ihre Tonart selbst nennt** (#398): Ohne die Zeile
 * nimmt die App die Tonart des Originals an, und eine in D geschriebene Fassung eines G-Liedes würde
 * von G aus transponiert. Eingefügt wird hinter dem Kopfblock (die führenden Direktiven-Zeilen) –
 * dort, wo ChordPro Kopfangaben erwartet und wo ein Mensch sie sucht.
 */
export function mitTonart(text: string, key: string): string {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => /^\s*\{key\s*:/i.test(l));
  if (idx >= 0) {
    lines[idx] = lines[idx].replace(/^(\s*\{key\s*:\s*)[^}]*(\})/i, `$1${key}$2`);
    return lines.join('\n');
  }
  // Hinter die führenden Direktiven ({title}, {artist} …); ganz oben, wenn es keine gibt.
  let ende = 0;
  while (ende < lines.length && /^\s*\{.*\}\s*$/.test(lines[ende])) ende++;
  lines.splice(ende, 0, `{key: ${key}}`);
  return lines.join('\n');
}
