import { parseLine } from '../utils/chordpro';
import { transposeChord } from '../utils/transpose';
import styles from './ChordLine.module.scss';

interface ChordLineProps {
  line: string;
  /** Halbton-Verschiebung für die Akkorde. */
  semitones: number;
  /** Schriftgröße in px. */
  fontSize: number;
  /** b-Schreibweise statt #. */
  flat?: boolean;
  /** Nur-Text-Modus: Akkorde ausblenden, reine Instrumentalzeilen überspringen. */
  lyricsOnly?: boolean;
  /** Breite des Leerraums (in ch) für Taktstriche „[|]" statt eines sichtbaren Strichs. */
  chordGap?: number;
}

/** Erkennt einen Taktstrich-„Akkord" (z.B. [|], [||]). */
function isBar(chord: string | null): boolean {
  return !!chord && /^[|¦/]+$/.test(chord.trim());
}

/** Rendert eine einzelne ChordPro-Zeile (Akkorde über dem Text). */
export function ChordLine({ line, semitones, fontSize, flat = false, lyricsOnly = false, chordGap = 2 }: ChordLineProps) {
  const pairs = parseLine(line);
  const hasChord = pairs.some((p) => p.chord);
  const hasLyric = pairs.some((p) => p.text && p.text.trim());

  if (lyricsOnly) {
    if (!hasLyric) return null; // reine Akkord-/Instrumentalzeile überspringen
    return (
      <div className={styles.lyricsOnly} style={{ fontSize }}>
        {pairs
          .map((p) => p.text)
          .join('')
          .replace(/\s+/g, ' ')
          .trimStart() || ' '}
      </div>
    );
  }

  if (!hasChord) {
    return (
      <div className={styles.plain} style={{ fontSize }}>
        {pairs
          .map((p) => p.text)
          .join('')
          .replace(/ {2,}/g, ' ')}
      </div>
    );
  }

  if (!hasLyric) {
    // Reine Akkordzeile: Taktstriche weglassen, Abstand zwischen Akkorden = chordGap
    return (
      <div className={styles.chordOnly} style={{ fontSize }}>
        {pairs
          .filter((p) => p.chord && !isBar(p.chord))
          .map((p, i) => (
            <span key={i} style={{ marginRight: `${chordGap}ch` }}>
              {transposeChord(p.chord as string, semitones, flat)}
            </span>
          ))}
      </div>
    );
  }

  return (
    <div className={styles.chordLine}>
      {pairs.map((p, i) => {
        const ch = p.chord ? transposeChord(p.chord, semitones, flat) : null;
        const realLyric = !!(p.text && p.text.trim());

        // Taktstrich „[|]" ganz weglassen – der Abstand kommt von den Akkord-Zellen
        if (isBar(p.chord)) return null;

        // Akkord ohne echten Text (Instrumental) → Akkord + einstellbarer Abstand dahinter
        if (ch && !realLyric) {
          return (
            <span key={i} className={styles.cpair} style={{ marginRight: `${chordGap}ch` }}>
              <span className={styles.cChord} style={{ fontSize: fontSize * 0.86 }}>
                {ch}
              </span>
              <span className={styles.cLyric} style={{ fontSize }} aria-hidden>
                {'​'}
              </span>
            </span>
          );
        }

        // Reiner Leerraum ohne Akkord → weglassen (kein Strichrest)
        if (!ch && !realLyric) return null;

        // Normalfall: Akkord über Text (oder reiner Text)
        return (
          <span key={i} className={styles.cpair}>
            <span
              className={styles.cChord}
              style={{ fontSize: fontSize * 0.86, visibility: ch ? 'visible' : 'hidden' }}
            >
              {ch || '​'}
            </span>
            <span className={styles.cLyric} style={{ fontSize }}>
              {(p.text || (ch ? ' ' : '')).replace(/ {2,}/g, ' ')}
            </span>
          </span>
        );
      })}
    </div>
  );
}
