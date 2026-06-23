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
  /** Zusätzlicher Halbton-Versatz nur dieses Abschnitts (Issue #16) – für die Markierung. */
  shift?: number;
}

/** Rendert einen ChordPro-Abschnitt (Vers, Chorus, …) mit Typ-Label. */
export function Section({
  section,
  semitones,
  fontSize,
  flat = false,
  lyricsOnly = false,
  chordGap,
  shift = 0,
}: SectionProps) {
  // Im Nur-Text-Modus reine Instrumental-Abschnitte (ohne Text) ausblenden
  if (lyricsOnly) {
    const anyLyric = section.lines.some(
      (ln) => ln && parseLine(ln).some((p) => p.text && p.text.trim()),
    );
    if (!anyLyric) return null;
  }

  const typeClass = styles[section.type] ?? styles.verse;
  const shiftLabel = shift ? (shift > 0 ? `+${shift}` : `${shift}`) : null;

  return (
    <div className={`${styles.sectionBlock} ${typeClass}`}>
      {(section.label || shiftLabel) && (
        <div className={styles.secLabel} style={{ fontSize: Math.max(12, Math.round(fontSize * 0.8)) }}>
          {section.label}
          {shiftLabel && (
            <span className={styles.shiftBadge} title="Dieser Abschnitt ist transponiert">
              {shiftLabel}
            </span>
          )}
        </div>
      )}
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
