import type { Absence } from '@shared/types/index';
import { Sheet } from './Sheet';
import { tagKurz, zeitraumKurz } from '../utils/absenceDatum';
import styles from '../pages/Availability.module.scss';

interface ZeitraumFrageProps {
  /** Der Termintag, dessen Haken entfernt werden soll. */
  tag: string;
  /** Der Zeitraum, in dem er liegt. */
  absence: Absence;
  /**
   * Die **anderen** Termine, die derselbe Eintrag abdeckt (23.09.2026, Code-Check vor v2.25.2).
   *
   * Ein ganztägiger Eintrag gilt für jeden Termin des Tages. Wer bei einem Termin den Haken wegnimmt,
   * löscht ihn damit auch für die anderen – das muss dastehen, bevor es passiert. Leer = klassischer
   * Fall „Teil eines mehrtägigen Zeitraums".
   */
  weitereTermine?: string[];
  /** „Zeitraum löschen" – der Aufrufer merkt es vor, geschrieben wird erst mit „Speichern". */
  onLoeschen: () => void;
  /** „Zeitraum anpassen" – öffnet das Fenster mit Von/Bis. */
  onAnpassen: () => void;
  onClose: () => void;
}

/**
 * Rückfrage, wenn ein Termin aus einem Eintrag herausgenommen werden soll, der **mehr als ihn**
 * abdeckt – ein mehrtägiger Zeitraum oder ein ganztägiger Eintrag mit weiteren Terminen am Tag
 * (Wunsch Alwin, 19.09.2026: „soll möglich sein, aber mit dem Hinweis, dass der Zeitraum dann
 * gelöscht wird – oder ob man ihn anpassen möchte").
 *
 * Ein einzelner Tag lässt sich aus einem Zeitraum nicht herauslösen, ohne ihn zu zerteilen – das
 * entscheidet der Mensch, nicht ein stummes Häkchen.
 */
export function ZeitraumFrage({
  tag,
  absence,
  weitereTermine = [],
  onLoeschen,
  onAnpassen,
  onClose,
}: ZeitraumFrageProps) {
  const ganzerTag = weitereTermine.length > 0;
  const wort = ganzerTag ? 'Eintrag' : 'Zeitraum';
  return (
    <Sheet title={ganzerTag ? 'Gilt für den ganzen Tag' : 'Teil eines Zeitraums'} onClose={onClose}>
      <p className={styles.frageText}>
        <b>{tagKurz(tag)}</b> gehört zu{' '}
        <b>
          {absence.reason ?? 'Abwesend'}, {zeitraumKurz(absence)}
        </b>
        {absence.comment ? ` (${absence.comment})` : ''}.{' '}
        {ganzerTag ? (
          <>
            Dieser Eintrag gilt für den <b>ganzen Tag</b> und damit auch für{' '}
            <b>{weitereTermine.join(', ')}</b>. Nimmst du ihn weg, ist der Haken dort ebenfalls weg
            – du kannst ihn löschen oder auf eine Uhrzeit anpassen.
          </>
        ) : (
          <>
            Ein einzelner Tag lässt sich daraus nicht herausnehmen – du kannst den Zeitraum löschen
            oder anpassen.
          </>
        )}
      </p>
      <button className={styles.loeschenWide} onClick={onLoeschen}>
        {wort} löschen
      </button>
      <button className={`${styles.primaryWide} ${styles.abstandOben}`} onClick={onAnpassen}>
        {wort} anpassen
      </button>
    </Sheet>
  );
}
