/**
 * **Ein Angebot unter der Trefferliste** – „Auch in den Liedtexten nach … suchen", „Bei SongSelect nach …
 * suchen" (#378).
 *
 * Der Knopf stand als JSX-Zuweisung im Liederheft (`zuLiedtexten`), und mit dem Ende des
 * Quellen-Umschalters (03.09.2026) braucht ihn auch der Einfüge-Dialog – für zwei Quellen. Drei Kopien
 * desselben Knopfs wären der Anfang, an dem eine spätere Änderung nur einen Teil trifft.
 *
 * Bewusst zurückhaltend (Textknopf, kein Kasten): Er ist ein Angebot, keine Hauptaktion. Die Hauptsache
 * steht darüber – die Bibliothek.
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
      <Icon name="search" size={15} stroke={2.2} />
      {text}
    </button>
  );
}
