/**
 * **Eine dezente Zeile am Ende der Trefferliste** – „Auch in den Liedtexten nach … suchen", „Bei
 * SongSelect nach … suchen" (#378).
 *
 * Bis zum 03.09.2026 stand dafür ein blauer Textknopf unter der Liste, der wie eine Aktion wirkte.
 * Alwins Rückmeldung (04.09.2026): Er will **eine** Liste, in der das Lied einfach erscheint – die
 * Wege zu den anderen Quellen sollen nicht wie Knöpfe dazwischenstehen. Deshalb sieht das Angebot jetzt
 * aus wie eine Listenzeile: ruhig, mit Pfeil, in der Farbe der Unterzeilen. Es ist ein Weg, keine
 * Hauptaktion.
 *
 * Gemeinsam für Liederheft und Einfüge-Dialog – drei Kopien desselben Knopfs wären der Anfang, an dem
 * eine spätere Änderung nur einen Teil trifft.
 */
import { Icon } from './icons';
import styles from './SucheAngebot.module.scss';

interface SucheAngebotProps {
  text: string;
  onClick: () => void;
}

export function SucheAngebot({ text, onClick }: SucheAngebotProps) {
  return (
    <button className={styles.angebot} onClick={onClick}>
      <Icon name="search" size={15} stroke={2} className={styles.lupe} aria-hidden />
      <span className={styles.text}>{text}</span>
      <Icon name="chev-right" size={16} stroke={2.2} className={styles.pfeil} aria-hidden />
    </button>
  );
}
