/**
 * **Der gemeinsame Suchkopf: ein Feld, darunter die Quellen** (#378).
 *
 * Steht im Liederheft, in „Lied hinzufügen" und in „Lied verknüpfen" – **dieselbe Anordnung überall**
 * (Festlegung Alwin, 13.08.2026). Vorher hatte jede dieser Ansichten ihr eigenes Suchfeld, und die
 * SongSelect-Suche lag zusätzlich im Blatt „Neues Lied".
 *
 * Was hier **nicht** liegt: die Trefferlisten. Die Bibliothek zeigt in jeder Ansicht etwas anderes (im
 * Liederheft mit „+"- und Stift-Knopf, in der Auswahl ohne), deshalb rendert sie der Aufrufer. Die beiden
 * anderen Quellen sehen überall gleich aus und stehen in eigenen Komponenten.
 */
import type { LiedQuelle } from '../hooks/useLiedSuche';
import { QUELLE_BESCHRIFTUNG } from '../hooks/useLiedSuche';
import { SONGSELECT_MIN_ZEICHEN } from '../hooks/useServices';
import { sucheArt } from '../utils/liedFormular';
import { Segment } from './Segment';
import { Icon } from './icons';
import styles from './LiedSucheKopf.module.scss';

/** Der Platzhalter sagt, was die **gewählte** Quelle versteht – sie verstehen Verschiedenes. */
const PLATZHALTER: Record<LiedQuelle, string> = {
  bibliothek: 'Lied oder Autor suchen…',
  liedtext: 'Wort aus dem Liedtext…',
  songselect: 'Liedtitel oder CCLI-Nummer eintippen …',
};

interface LiedSucheKopfProps {
  eingabe: string;
  onEingabe: (wert: string) => void;
  quelle: LiedQuelle;
  quellen: LiedQuelle[];
  onQuelle: (q: LiedQuelle) => void;
  /** Sofort bei SongSelect abfragen – der Knopf erlaubt auch kurze CCLI-Nummern. */
  onJetztSuchen: () => void;
  autoFocus?: boolean;
}

export function LiedSucheKopf({
  eingabe,
  onEingabe,
  quelle,
  quellen,
  onQuelle,
  onJetztSuchen,
  autoFocus,
}: LiedSucheKopfProps) {
  const beiSongSelect = quelle === 'songselect';
  /** Was die Eingabe gerade **ist** – bestimmt die Beschriftung, noch vor dem Abschicken. */
  const eingabeArt = sucheArt(eingabe);

  return (
    <div className={styles.kopf}>
      <div className={styles.zeile}>
        <div className={styles.feld}>
          <Icon name="search" size={18} stroke={2} className={styles.lupe} />
          <input
            placeholder={PLATZHALTER[quelle]}
            value={eingabe}
            autoFocus={autoFocus}
            onChange={(e) => onEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && beiSongSelect) onJetztSuchen();
            }}
          />
        </div>
        {/**
         * Der Knopf steht **nur** bei SongSelect: Die Bibliothek filtert beim Tippen, die Liedtexte
         * suchen entprellt von selbst. Bei CCLI ist er nötig, weil die automatische Regel eine kurze
         * Nummer zurückhält – und weil man eine Suche, die ~800 ms dauert, willentlich auslösen will.
         */}
        {beiSongSelect && (
          <button
            className={styles.knopf}
            onClick={onJetztSuchen}
            disabled={eingabe.trim().length < SONGSELECT_MIN_ZEICHEN}
          >
            {/* „Abfragen" statt „Suchen", sobald es nach einer Nummer aussieht: Sie liefert genau ein
                Lied, keine Trefferliste – das darf der Knopf sagen. */}
            {eingabeArt.art === 'nummer' ? 'Abfragen' : 'Suchen'}
          </button>
        )}
      </div>

      {/**
       * Der Umschalter erscheint nur, wenn es **mehr als eine** Quelle gibt. Ohne SongSelect-Lizenz
       * bleiben zwei – auch dann lohnt er sich, denn „Liedtexte" ist der Grund, warum es ihn gibt.
       */}
      {quellen.length > 1 && (
        <Segment
          value={quelle}
          options={quellen.map((q) => ({ value: q, label: QUELLE_BESCHRIFTUNG[q] }))}
          onChange={onQuelle}
        />
      )}
    </div>
  );
}
