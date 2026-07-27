/**
 * Die Bausteine EINER Ablaufzeile (#198 – vorher in `pages/Setlist.tsx`).
 *
 * Drei kleine Teile, die immer zusammen auftreten: die Bezeichnung des Punkts, das Icon der
 * Zuständigen und deren Zeile. Sie werden von der Ablauf-Ansicht UND von der sortierbaren Zeile
 * im Bearbeiten-Modus verwendet – deshalb gemeinsam und außerhalb beider.
 */
import type { AgendaItem } from '@shared/types/index';
import { itemTitleParts } from '../utils/agendaItemTitle';
import styles from '../pages/Setlist.module.scss';

/**
 * Bezeichnung eines Ablaufpunkts wie in ChurchTools (#200): eigener Titel, dahinter – falls er
 * etwas hinzufügt – der Liedname. Die Regeln stecken in `utils/agendaItemTitle`.
 */
export function ItemTitle({ item }: { item: AgendaItem }) {
  const { title, songName } = itemTitleParts(item);
  return (
    <span className={styles.flowTitle}>
      {title}
      {songName && <span className={styles.flowSongName}>{songName}</span>}
    </span>
  );
}

/** Dezentes Linien-Icon für die Zuständigen (statt Emoji). */
export function RespIcon() {
  return (
    <svg
      className={styles.respIcon}
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
    </svg>
  );
}

/** Zeile der Zuständigen: besetzte als Name, offene Dienste rot mit „?". */
export function ResponsibleLine({ entries }: { entries: AgendaItem['responsible'] }) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.resp}>
      <RespIcon />
      <span className={styles.respList}>
        {entries.map((e, i) => {
          // Kommagetrennt; das Komma steht MIT im Namens-Span, damit es beim Umbruch am Namen bleibt.
          const sep = i < entries.length - 1 ? ',' : '';
          return e.open ? (
            <span key={i} className={styles.respOpen}>
              {e.label} ?{sep}
            </span>
          ) : (
            <span key={i} className={styles.respName}>
              {e.label}
              {sep}
            </span>
          );
        })}
      </span>
    </div>
  );
}
