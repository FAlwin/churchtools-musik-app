import styles from './GrosseUeberschrift.module.scss';

interface Props {
  children: string;
  /** Zweite Zeile unter dem Titel, z. B. Wochentag und Uhrzeit eines Ablaufs. */
  unterzeile?: string;
  /**
   * Für Bildschirme, die **über** der Überschrift noch eine Leiste haben (Detailansichten mit
   * Zurück-Pfeil): Dann hält die Leiste den Abstand zum Unschärfe-Band, die Überschrift braucht
   * ihn nicht noch einmal.
   */
  ohneAbstand?: boolean;
}

/**
 * Die große Überschrift am Anfang eines Bildschirms (22.09.2026).
 *
 * Alwin: „vielleicht lassen wir den Titel in der Mitte weg und machen es transparent?" – so wie
 * WhatsApp: Der Titel steht groß im Inhalt, oben gibt es keine Fläche, die Platz kostet. Beim
 * Scrollen läuft der Inhalt unter das Unschärfe-Band von iOS 26/27 (siehe `client/index.html`) und
 * wird dort weich – das ist der native Look, kein Fehler. Welcher Tab offen ist, sagt die Leiste
 * unten; in Detailansichten steht der Zurück-Pfeil weiterhin oben.
 *
 * Der Abstand nach oben (`--inhalt-pad-top`, in der iOS-App Safe-Area + 36 px) hält die Überschrift
 * im Ruhezustand unter Uhr und Band; er gehört zum Inhalt und scrollt mit weg.
 */
export function GrosseUeberschrift({ children, unterzeile, ohneAbstand }: Props) {
  return (
    <div className={ohneAbstand ? styles.blockOhneAbstand : styles.block}>
      <h1 className={styles.gross}>{children}</h1>
      {unterzeile && <div className={styles.unterzeile}>{unterzeile}</div>}
    </div>
  );
}
