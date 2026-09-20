import type { SongLibraryEntry } from '@shared/types/index';
import { Sheet } from './Sheet';
import styles from './NewSongSheet.module.scss';

interface LiedSchonVorhandenProps {
  /** Das Lied, das dieselbe CCLI-Nummer schon trägt. */
  vorhanden: SongLibraryEntry;
  /**
   * Das vorhandene Lied nehmen – was das heißt, weiß der Aufrufer: in den Ablauf eintragen, mit dem
   * Punkt verknüpfen oder öffnen. Fehlt der Weg, gibt es den Knopf nicht (dann bleiben Anlegen und
   * Abbrechen).
   */
  onVerwenden?: (song: SongLibraryEntry) => void;
  /** Trotzdem ein zweites Lied anlegen – **ohne** die CCLI-Nummer, die gehört dem vorhandenen. */
  onTrotzdem: () => void;
  onClose: () => void;
}

/**
 * **„Dieses Lied gibt es schon"** (#395, Wunsch Alwin am 19.09.2026).
 *
 * Vorher lief dieser Fall in eine Sackgasse: Man füllte das Formular, drückte „Lied anlegen" und bekam
 * vom Server eine Fehlermeldung – der einzige Ausweg war Abbrechen und von vorn. Jetzt fragt die App
 * vorher und zeigt, **welches** Lied die Nummer schon hat, samt Autor und Tonart.
 *
 * Drei Wege, und alle drei führen irgendwohin:
 *  1. **Das vorhandene verwenden** – der übliche Fall, wenn man das Lied nur in den Ablauf wollte.
 *  2. **Trotzdem neu anlegen** – dann aber ohne CCLI-Nummer. Das ist keine Schikane: ChurchTools lässt
 *     dieselbe Nummer kein zweites Mal zu, der Server lehnt ab (409). Wer wirklich eine eigene Fassung
 *     will, bekommt sie so – nur eben ohne die Nummer des Originals.
 *  3. **Abbrechen** – zurück ins Formular, alles bleibt stehen.
 */
export function LiedSchonVorhanden({
  vorhanden,
  onVerwenden,
  onTrotzdem,
  onClose,
}: LiedSchonVorhandenProps) {
  // „Zurück zum Formular", nicht „Abbrechen": Das Formular liegt sichtbar darunter und hat selbst einen
  // Abbrechen-Knopf – zwei gleich beschriftete Knöpfe übereinander sagten nicht, welcher was tut
  // (gefunden beim Schreiben der Tests, 20.09.2026).
  return (
    <Sheet title="Dieses Lied gibt es schon" cancelLabel="Zurück zum Formular" onClose={onClose}>
      <div className={styles.hint}>
        <b>„{vorhanden.name}"</b>
        {vorhanden.author ? ` von ${vorhanden.author}` : ''} trägt schon die CCLI-Nummer{' '}
        {vorhanden.ccli}
        {vorhanden.key ? ` (Tonart ${vorhanden.key})` : ''}. Eine Nummer kann in ChurchTools nur
        einmal vergeben sein.
      </div>

      <div className={styles.actions}>
        {onVerwenden && (
          <button className={styles.primaryWide} onClick={() => onVerwenden(vorhanden)}>
            „{vorhanden.name}" verwenden
          </button>
        )}
        <button
          className={onVerwenden ? styles.secondaryWide : styles.primaryWide}
          onClick={onTrotzdem}
        >
          Trotzdem neu anlegen
        </button>
      </div>

      <div className={styles.hint}>
        Ein zweites Lied bekommt <b>keine CCLI-Nummer</b> – die bleibt beim vorhandenen. Du kannst
        sie später am richtigen Lied ergänzen.
      </div>
    </Sheet>
  );
}
