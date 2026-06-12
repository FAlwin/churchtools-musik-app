import type { ChordProSection } from '@shared/types/index';
import { parseLine } from '../utils/chordpro';
import { ChordLine } from './ChordLine';
import styles from './Section.module.scss';

interface SectionProps {
  section: ChordProSection;
  semitones: number;
  fontSize: number;
  flat?: boolean;
  lyricsOnly?: boolean;
  chordGap?: number;
}

/** Rendert einen ChordPro-Abschnitt (Vers, Chorus, …) mit Typ-Label. */
export function Section({ section, semitones, fontSize, flat = false, lyricsOnly = false, chordGap }: SectionProps) {
  // Im Nur-Text-Modus reine Instrumental-Abschnitte (ohne Text) ausblenden
  if (lyricsOnly) {
    const anyLyric = section.lines.some(
      (ln) => ln && parseLine(ln).some((p) => p.text && p.text.trim()),
    );
    if (!anyLyric) return null;
  }

  const typeClass = styles[section.type] ?? styles.verse;

  return (
    <div className={`${styles.sectionBlock} ${typeClass}`}>
      {section.label && <div className={styles.secLabel}>{section.label}</div>}
      {section.lines.map((ln, i) =>
        ln === '' ? (
          <div key={i} className={styles.gap} />
        ) : (
          <ChordLine
            key={i}
            line={ln}
            semitones={semitones}
            fontSize={fontSize}
            flat={flat}
            lyricsOnly={lyricsOnly}
            chordGap={chordGap}
          />
        ),
      )}
    </div>
  );
}
