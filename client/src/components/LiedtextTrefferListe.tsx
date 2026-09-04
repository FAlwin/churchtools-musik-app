/**
 * Die Trefferliste der Quelle **„Liedtexte"** (#378) – vorher als lokale Komponente in `AllSongs`.
 *
 * Herausgezogen, weil sie an drei Stellen erscheint (Liederheft, „Lied hinzufügen", „Lied verknüpfen").
 * Als lokale Komponente wäre sie dreimal entstanden. Sie wird nur mit einem **abgeschickten** Begriff
 * gerendert – wann das Angebot erscheint, entscheidet `useLiedSuche`.
 *
 * **Der Ausschnitt ist das Wesentliche:** Er zeigt, *warum* ein Lied gefunden wurde. Ohne ihn müsste man
 * jedes öffnen und nachsehen. Er kommt kleingeschrieben und ohne Akkorde vom Server – so wurde gesucht,
 * und das darzustellen ist ehrlicher, als einen geglätteten Text vorzuzeigen, der anders klingt.
 *
 * **Zwei Gesichter, eine Zeile** (`LiedZeile`, 04.09.2026): Im Einfüge-Dialog gibt es `onEinfuegen`, dann
 * hat die Zeile Auge und Plus wie alle anderen dort. Im Liederheft fehlt es – ein Tipp führt direkt ins
 * Lied, und es gibt nichts einzufügen.
 */
import type { SongLibraryEntry } from '@shared/types/index';
import { useLiedtextSuche } from '../hooks/useServices';
import { liedAnzahl } from '../utils/songFilter';
import { LiedZeile } from './LiedZeile';
import styles from './LiedTreffer.module.scss';

interface LiedtextTrefferListeProps {
  /** Der abgeschickte Begriff (`''` = noch zu kurz, es läuft nichts). */
  begriff: string;
  /** Die Bibliothek – über sie wird aus einer `songId` ein anklickbares Lied. */
  songs: SongLibraryEntry[];
  /** Der Tipp auf die Zeile: im Einfüge-Dialog die Vorschau, im Liederheft das Lied. */
  onPick: (song: SongLibraryEntry) => void;
  /** Das Plus – nur im Einfüge-Dialog. */
  onEinfuegen?: { label: string; onClick: (song: SongLibraryEntry) => void };
  /** Deaktiviert die Treffer, während ein Vorgang läuft. */
  busy?: boolean;
}

export function LiedtextTrefferListe({
  begriff,
  songs,
  onPick,
  onEinfuegen,
  busy,
}: LiedtextTrefferListeProps) {
  const suche = useLiedtextSuche(begriff, begriff !== '');

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
          <LiedZeile
            key={t.songId}
            titel={t.name}
            unterzeile={t.ausschnitt}
            onZeile={() => bekannt && onPick(bekannt)}
            aktion={
              onEinfuegen && bekannt
                ? { label: onEinfuegen.label, onClick: () => onEinfuegen.onClick(bekannt) }
                : undefined
            }
            disabled={busy || !bekannt}
          />
        );
      })}
    </div>
  );
}
