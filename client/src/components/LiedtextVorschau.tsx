/**
 * **Liedtext-Vorschau: „Text zeigen"** (#379).
 *
 * Anlass (Alwin, 13.08.2026): Heißen mehrere Lieder gleich und ist der Autor unbekannt oder ebenfalls
 * gleich, ist ohne einen Blick in den Text nicht zu entscheiden, welches gemeint ist. Bisher musste man
 * jedes einzeln öffnen und wieder zurück.
 *
 * **Auf Verlangen je Lied** (Entscheidung Alwin, 14.08.2026), nicht dauerhaft unter jedem Titel: Eine
 * Vorschau in jeder Zeile hieße eine Anfrage je Zeile – für eine Liste, die man nur durchsieht. Und auf
 * einem Notenpult im Gottesdienst ist Ruhe wichtiger als Vollständigkeit.
 *
 * **Eine Komponente für alle drei Orte** (Liederheft, Lied-Auswahl, Liedtext-Treffer). Drei Kopien wären
 * genau der Anfang, an dem eine späte Änderung nur zwei davon erreicht – die teuerste Fehlerklasse in
 * diesem Projekt.
 *
 * Der Server baut dafür **keinen** Suchindex: Steht er ohnehin frisch, kommt die Antwort daraus; sonst
 * lädt er genau dieses eine Notenblatt (siehe `songTextIndex.liedtextVorschau`).
 */
import { useState } from 'react';
import { useLiedtextVorschau } from '../hooks/useServices';
import { Icon } from './icons';
import styles from './LiedtextVorschau.module.scss';

interface LiedtextVorschauProps {
  songId: number;
  /**
   * Wofür die Vorschau gilt – steht im Vorlesetext des Knopfs.
   *
   * Ohne den Namen hieße es in einer Liste zwanzigmal „Text zeigen", und eine Vorlesehilfe könnte die
   * Knöpfe nicht auseinanderhalten.
   */
  songName: string;
}

export function LiedtextVorschau({ songId, songName }: LiedtextVorschauProps) {
  const [offen, setOffen] = useState(false);
  const vorschau = useLiedtextVorschau(songId, offen);

  if (!offen) {
    return (
      <button
        className={styles.knopf}
        aria-label={`Liedtext-Anfang von „${songName}" zeigen`}
        onClick={(e) => {
          // Die Zeile darunter öffnet das Lied – die Vorschau soll genau das NICHT tun.
          e.stopPropagation();
          setOffen(true);
        }}
      >
        <Icon name="type" size={14} stroke={2.2} />
        Text zeigen
      </button>
    );
  }

  return (
    <div className={styles.block}>
      {vorschau.isLoading ? (
        <span className={styles.still}>Liedtext wird geholt …</span>
      ) : vorschau.isError ? (
        /* Der Grund kommt vom Server: „ChurchTools bremst uns aus" ist etwas anderes als ein Fehler
           (#270). Ein Fehlschlag hier ist harmlos – das Lied bleibt öffenbar. */
        <span className={styles.still}>
          {vorschau.error instanceof Error
            ? vorschau.error.message
            : 'Der Liedtext konnte nicht geholt werden.'}
        </span>
      ) : vorschau.data?.vorschau ? (
        <span className={styles.text}>{vorschau.data.vorschau}</span>
      ) : (
        /* `null` heißt „kein Notenblatt, kein Text" – ein eigener Fall, kein Fehler. Eine leere
           Vorschau stehen zu lassen wäre schlimmer: Sie sähe nach einem Ladeproblem aus. */
        <span className={styles.still}>Für dieses Lied liegt kein Liedtext vor.</span>
      )}
      <button
        className={styles.zu}
        aria-label={`Liedtext-Anfang von „${songName}" ausblenden`}
        onClick={(e) => {
          e.stopPropagation();
          setOffen(false);
        }}
      >
        ausblenden
      </button>
    </div>
  );
}
