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
}

/** Rendert eine einzelne ChordPro-Zeile (Akkorde über dem Text). */
export function ChordLine({ line, semitones, fontSize, flat = false, lyricsOnly = false }: ChordLineProps) {
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
        {pairs.map((p) => p.text).join('')}
      </div>
    );
  }

  if (!hasLyric) {
    return (
      <div className={styles.chordOnly} style={{ fontSize }}>
        {pairs
          .filter((p) => p.chord)
          .map((p, i) => (
            <span key={i}>{transposeChord(p.chord as string, semitones, flat)}</span>
          ))}
      </div>
    );
  }

  return (
    <div className={styles.chordLine}>
      {pairs.map((p, i) => {
        const ch = p.chord ? transposeChord(p.chord, semitones, flat) : null;
        return (
          <span key={i} className={styles.cpair}>
            <span
              className={styles.cChord}
              style={{ fontSize: fontSize * 0.86, visibility: ch ? 'visible' : 'hidden' }}
            >
              {ch || '​'}
            </span>
            <span className={styles.cLyric} style={{ fontSize }}>
              {p.text || (ch ? ' ' : '')}
            </span>
          </span>
        );
      })}
    </div>
  );
}
