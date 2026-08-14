/**
 * Die Trefferliste der Quelle **„Liedtexte"** (#378) – vorher als lokale Komponente in `AllSongs`.
 *
 * Herausgezogen, weil sie seit dem Quellen-Umschalter an drei Stellen erscheint (Liederheft, „Lied
 * hinzufügen", „Lied verknüpfen"). Als lokale Komponente wäre sie dreimal entstanden.
 *
 * **Der Ausschnitt ist das Wesentliche:** Er zeigt, *warum* ein Lied gefunden wurde. Ohne ihn müsste man
 * jedes öffnen und nachsehen. Er kommt kleingeschrieben und ohne Akkorde vom Server – so wurde gesucht,
 * und das darzustellen ist ehrlicher, als einen geglätteten Text vorzuzeigen, der anders klingt.
 */
import type { SongLibraryEntry } from '@shared/types/index';
import { LIEDTEXT_SUCHE_MIN_ZEICHEN } from '@shared/types/index';
import { useLiedtextSuche } from '../hooks/useServices';
import { liedAnzahl } from '../utils/songFilter';
import { Icon } from './icons';
import styles from './LiedTreffer.module.scss';

interface LiedtextTrefferListeProps {
  /** Der abgeschickte Begriff (`''` = noch zu kurz, es läuft nichts). */
  begriff: string;
  /** Die Bibliothek – über sie wird aus einer `songId` ein anklickbares Lied. */
  songs: SongLibraryEntry[];
  onPick: (song: SongLibraryEntry) => void;
  /** Deaktiviert die Treffer, während ein Vorgang läuft. */
  busy?: boolean;
}

export function LiedtextTrefferListe({ begriff, songs, onPick, busy }: LiedtextTrefferListeProps) {
  const suche = useLiedtextSuche(begriff, begriff !== '');

  if (begriff === '') {
    return (
      <div className={styles.hinweis}>
        Tippe mindestens {LIEDTEXT_SUCHE_MIN_ZEICHEN} Zeichen – gesucht wird dann in den Liedtexten,
        nicht nur im Titel.
      </div>
    );
  }

  if (suche.isLoading) {
    return (
      <div className={styles.hinweis}>
        Liedtexte werden durchsucht … Beim ersten Mal dauert das einen Moment – dafür holt die App
        jeden Liedtext einmal von ChurchTools.
      </div>
    );
  }

  // Der Grund kommt vom Server: „ChurchTools bremst uns aus" ist etwas anderes als ein Fehler (#270).
  if (suche.isError) {
    return (
      <div className={styles.hinweis}>
        {suche.error instanceof Error
          ? suche.error.message
          : 'Die Suche in den Liedtexten hat nicht geklappt.'}
      </div>
    );
  }

  const treffer = suche.data ?? [];
  if (treffer.length === 0) {
    return <div className={styles.hinweis}>In den Liedtexten steht „{begriff}" nicht.</div>;
  }

  return (
    <div className={styles.liste}>
      <div className={styles.kopf}>
        {liedAnzahl(treffer.length)} mit „{begriff}" im Text
      </div>
      {treffer.map((t) => {
        /**
         * Ein Treffer, der nicht in der Bibliothek steht, bleibt sichtbar aber unantastbar. Das kann
         * vorkommen: Der Index hält eine Stunde, die Liste ist frischer – ein gerade in ChurchTools
         * gelöschtes Lied stünde noch im Index. Ihn wegzulassen wäre unehrlich, ihn anklickbar zu machen
         * ein Fehlerschirm.
         */
        const bekannt = songs.find((s) => s.songId === t.songId);
        return (
          <button
            key={t.songId}
            className={styles.zeile}
            disabled={busy || !bekannt}
            onClick={() => bekannt && onPick(bekannt)}
          >
            <span className={styles.text}>
              <span className={styles.titel}>{t.name}</span>
              {/* Der Ausschnitt zeigt die **Fundstelle** (kleingeschrieben, so wurde gesucht). Den
                  ganzen Liedanfang zeigt im Einfüge-Dialog die Vorschau nach dem Antippen (#379) – im
                  Liederheft führt ein Tipp direkt ins Lied. */}
              <span className={styles.meta}>{t.ausschnitt}</span>
            </span>
            <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
          </button>
        );
      })}
    </div>
  );
}
