import type { Absence } from '@shared/types/index';
import { Sheet } from './Sheet';
import { tagKurz, zeitraumKurz } from '../utils/absenceDatum';
import styles from '../pages/Availability.module.scss';

interface ZeitraumFrageProps {
  /** Der Termintag, dessen Haken entfernt werden soll. */
  tag: string;
  /** Der Zeitraum, in dem er liegt. */
  absence: Absence;
  /** „Zeitraum löschen" – der Aufrufer merkt es vor, geschrieben wird erst mit „Speichern". */
  onLoeschen: () => void;
  /** „Zeitraum anpassen" – öffnet das Fenster mit Von/Bis. */
  onAnpassen: () => void;
  onClose: () => void;
}

/**
 * Rückfrage, wenn ein Termin aus einem **mehrtägigen** Zeitraum herausgenommen werden soll
 * (Wunsch Alwin, 19.09.2026: „soll möglich sein, aber mit dem Hinweis, dass der Zeitraum dann
 * gelöscht wird – oder ob man ihn anpassen möchte").
 *
 * Ein einzelner Tag lässt sich aus einem Zeitraum nicht herauslösen, ohne ihn zu zerteilen – das
 * entscheidet der Mensch, nicht ein stummes Häkchen.
 */
export function ZeitraumFrage({
  tag,
  absence,
  onLoeschen,
  onAnpassen,
  onClose,
}: ZeitraumFrageProps) {
  return (
    <Sheet title="Teil eines Zeitraums" onClose={onClose}>
      <p className={styles.frageText}>
        <b>{tagKurz(tag)}</b> gehört zu{' '}
        <b>
          {absence.reason ?? 'Abwesend'}, {zeitraumKurz(absence)}
        </b>
        {absence.comment ? ` (${absence.comment})` : ''}. Ein einzelner Tag lässt sich daraus nicht
        herausnehmen – du kannst den Zeitraum löschen oder anpassen.
      </p>
      <button className={styles.loeschenWide} onClick={onLoeschen}>
        Zeitraum löschen
      </button>
      <button className={`${styles.primaryWide} ${styles.abstandOben}`} onClick={onAnpassen}>
        Zeitraum anpassen
      </button>
    </Sheet>
  );
}
