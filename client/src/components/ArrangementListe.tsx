/**
 * Die **Arrangements eines Liedes** im Stammdaten-Blatt (#396).
 *
 * Alwins Wunsch vom 19.09.2026: Was der ChurchTools-Dialog kann, soll auch hier gehen – und zwar
 * dort, wo man ohnehin schon ist, wenn man ein Lied bearbeitet.
 *
 * **Die Liste zeigt, was man beim Suchen braucht**, nicht alles: Name, ob es der Standard ist, und
 * darunter in einer Zeile Tonart, Tempo, Länge und Quelle. Acht Felder untereinander wären eine
 * Tabelle, kein Überblick – die übrigen stehen im Fenster dahinter.
 *
 * **Die beiden Geländer stehen im Server** (`arrangementVerwaltung.ts`): Das letzte Arrangement und
 * das Standard-Arrangement lassen sich nicht löschen. Hier werden die Knöpfe dafür weggelassen –
 * nicht als zweite Prüfung, sondern damit niemand auf etwas tippt, das sicher abgelehnt wird.
 */
import type { ArrangementAnsicht } from '@shared/types/index';
import { Icon } from './icons';
import { unterzeile } from '../utils/arrangementFormular';
import styles from './ArrangementListe.module.scss';
import neu from './NewSongSheet.module.scss';

interface ArrangementListeProps {
  arrangements: ArrangementAnsicht[];
  onOeffnen: (arr: ArrangementAnsicht) => void;
  onNeu: () => void;
}

export function ArrangementListe({ arrangements, onOeffnen, onNeu }: ArrangementListeProps) {
  return (
    <div className={styles.block} data-tour="arrangements">
      <div className={styles.kopf}>Arrangements</div>

      <div className={styles.liste}>
        {arrangements.map((arr) => {
          const unter = unterzeile(arr);
          return (
            <button key={arr.id} className={styles.zeile} onClick={() => onOeffnen(arr)}>
              <span className={styles.text}>
                <span className={styles.name}>
                  {arr.name}
                  {arr.isDefault && <span className={styles.standard}>Standard</span>}
                </span>
                {unter && <span className={styles.unter}>{unter}</span>}
              </span>
              <Icon name="chev-right" size={16} stroke={2} className={styles.pfeil} />
            </button>
          );
        })}
      </div>

      <button className={neu.secondaryWide} onClick={onNeu}>
        <Icon name="plus" size={16} stroke={2} /> Weiteres Arrangement
      </button>
    </div>
  );
}
