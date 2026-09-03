/**
 * **Eine Liedzeile mit zwei Knöpfen** – die gemeinsame Zeile für Bibliothek, SongSelect und
 * Liedtext-Treffer im Einfüge-Dialog (#378, Wunsch Alwin 04.09.2026).
 *
 * „In der Liedzeile gibt es dann zwei Buttons – einmal um die Vorschau des Textes zu öffnen und zum
 * anderen kann man es direkt einfügen." Vorher sahen die drei Quellen verschieden aus (die Bibliothek
 * mit „+", SongSelect und Liedtexte mit einem Pfeil) und verhielten sich verschieden. Jetzt ist es
 * **eine** Zeile: Titel, darunter eine erklärende Zeile (Autor · Tonart, Autor · Nr. · Formate, oder der
 * Textausschnitt), rechts das **Auge** (Vorschau) und das **Plus** (einfügen).
 *
 * **Die ganze Zeile wirkt wie das Auge.** Auf dem iPad muss man so nicht auf ein 20-px-Symbol zielen;
 * das Symbol steht trotzdem da, damit man sieht, was der Tipp tut. Das Plus ist der eigene Knopf, weil
 * es die folgenreiche Aktion ist – es soll ein bewusster Griff bleiben.
 *
 * **Ohne `aktion` ist es eine einfache Zeile** mit Pfeil statt Auge – so nutzt sie das Liederheft für
 * die Liedtext-Treffer, wo ein Tipp direkt ins Lied führt und es nichts einzufügen gibt.
 */
import type { ReactNode } from 'react';
import { Icon } from './icons';
import styles from './LiedZeile.module.scss';

interface LiedZeileProps {
  titel: string;
  /** Die erklärende Zeile darunter – je Quelle etwas anderes. `null` = keine. */
  unterzeile?: string | null;
  /** Rechts vor den Knöpfen, z. B. die Tonart-Pille oder die Statistik. */
  zusatz?: ReactNode;
  /** Der Tipp auf die Zeile (Vorschau bzw. Öffnen). */
  onZeile: () => void;
  /** Der Plus-Knopf – fehlt er, ist es eine einfache Zeile mit Pfeil. */
  aktion?: { label: string; onClick: () => void };
  disabled?: boolean;
}

export function LiedZeile({
  titel,
  unterzeile,
  zusatz,
  onZeile,
  aktion,
  disabled,
}: LiedZeileProps) {
  return (
    <div className={styles.zeile}>
      <button className={styles.haupt} disabled={disabled} onClick={onZeile}>
        <span className={styles.text}>
          <span className={styles.titel}>{titel}</span>
          {unterzeile && <span className={styles.meta}>{unterzeile}</span>}
        </span>
        {zusatz}
        {/* Das Symbol sagt, was der Tipp tut – für Vorlese-Hilfen ist der Text der Zeile aussagekräftiger. */}
        <Icon
          name={aktion ? 'eye' : 'chev-right'}
          size={18}
          stroke={2.2}
          className={styles.symbol}
          aria-hidden
        />
      </button>
      {aktion && (
        <button
          className={styles.plus}
          disabled={disabled}
          onClick={aktion.onClick}
          aria-label={`„${titel}" ohne Vorschau hinzufügen`}
          title={aktion.label}
        >
          <Icon name="plus" size={19} stroke={2.4} />
        </button>
      )}
    </div>
  );
}
