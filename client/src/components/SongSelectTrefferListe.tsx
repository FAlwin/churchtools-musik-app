/**
 * Die Trefferliste der Quelle **„SongSelect"** (#378) – vorher inmitten von `NewSongSheet`.
 *
 * Seit dem 04.09.2026 sind ihre Zeilen **dieselben wie die der Bibliothek** (`LiedZeile`): Titel,
 * darunter Autoren · Nummer · Formate, rechts Auge und Plus. Alwins Wunsch war eine Liste, in der das Lied
 * einfach erscheint – gleich, woher es kommt. Die Herkunft steht trotzdem dran: in der Überschrift der
 * Gruppe und in der Nummer der Unterzeile. Ein SongSelect-Treffer und ein eigenes Lied führen zu
 * Verschiedenem (anlegen vs. einfügen), das darf man sehen.
 *
 * **Das Plus legt hier nicht sofort an, sondern öffnet „Neues Lied" vorbelegt** (Entscheidung Alwin,
 * 04.09.2026): Die Kategorie ist Pflicht und wird bewusst nicht vorbelegt – ohne sie kann ChurchTools kein
 * Lied annehmen. Titel, Autoren, Nummer und Tonart stehen dann schon drin.
 */
import type { SongSelectTreffer } from '@shared/types/index';
import { useSongSelectSuche } from '../hooks/useServices';
import { QUELLE_BESCHRIFTUNG } from '../hooks/useLiedSuche';
import { sucheArt, trefferUnterzeile } from '../utils/liedFormular';
import { CenterMessage } from './CenterMessage';
import { LiedZeile } from './LiedZeile';
import styles from './LiedTreffer.module.scss';

interface SongSelectTrefferListeProps {
  /** Der **abgeschickte** Begriff – nicht der Feldinhalt. Wird nur mit Begriff gerendert. */
  begriff: string;
  /** Der Tipp auf die Zeile: die Vorschau mit dem Liedtext von CCLI. */
  onVorschau: (treffer: SongSelectTreffer) => void;
  /** Das Plus: „Neues Lied" vorbelegt öffnen. */
  onEinfuegen: (treffer: SongSelectTreffer) => void;
  busy?: boolean;
}

export function SongSelectTrefferListe({
  begriff,
  onVorschau,
  onEinfuegen,
  busy,
}: SongSelectTrefferListeProps) {
  const suche = useSongSelectSuche(begriff, begriff !== '');
  /** Was zuletzt abgeschickt wurde – bestimmt nur die Wortwahl der Meldungen. */
  const gesucht = sucheArt(begriff);

  if (suche.isLoading) {
    return (
      <CenterMessage
        loading
        text={
          gesucht.art === 'nummer'
            ? `CCLI-Nummer ${gesucht.nummer} wird bei SongSelect abgefragt …`
            : 'Wird bei SongSelect gesucht …'
        }
      />
    );
  }

  // Der Grund kommt vom Server: fehlende Lizenz klingt anders als ein Aussetzer (#270).
  if (suche.isError) {
    return (
      <div className={styles.hinweis}>
        {suche.error instanceof Error
          ? suche.error.message
          : gesucht.art === 'nummer'
            ? `Die CCLI-Nummer ${gesucht.nummer} konnte bei SongSelect nicht abgefragt werden.`
            : 'Die Suche bei SongSelect ist fehlgeschlagen.'}
      </div>
    );
  }

  const liste = suche.data?.treffer ?? [];
  if (liste.length === 0) {
    return (
      <div className={styles.hinweis}>
        {gesucht.art === 'nummer'
          ? `Zu der Nummer ${gesucht.nummer} findet SongSelect kein Lied. Tippe den Titel ein, um nach dem Namen zu suchen.`
          : 'Keine Treffer bei SongSelect. Vielleicht ist es ein eigenes Lied – dann über „Neues Lied" selbst eintippen.'}
      </div>
    );
  }

  return (
    <div className={styles.liste}>
      {/* Die Quelle steht dran – wie „N Lieder mit … im Text" bei den Liedtexten. */}
      <div className={styles.kopf}>
        {QUELLE_BESCHRIFTUNG.songselect} · {liste.length} Treffer zu „{begriff}"
      </div>
      {liste.map((t) => (
        <LiedZeile
          key={t.songNumber}
          titel={t.title}
          unterzeile={trefferUnterzeile(t)}
          onZeile={() => onVorschau(t)}
          aktion={{ label: 'Als neues Lied anlegen …', onClick: () => onEinfuegen(t) }}
          disabled={busy}
        />
      ))}

      {/**
       * Blättern gibt es bei ChurchTools nicht: Es holt 100 Treffer auf einmal und zeigt keinen Weg
       * weiter (gemessen: 147 zu „Wo ich auch stehe"). **Ob die Liste vollständig ist, sagt der Server**
       * (`vollstaendig`) – ein `liste.length >= 100` daneben wäre dieselbe Rechnung ein zweites Mal.
       */}
      {suche.data && !suche.data.vollstaendig && (
        <div className={styles.hinweis}>
          SongSelect hat {suche.data.gesamt} Treffer zu „{begriff}", angezeigt werden {liste.length}
          . Ist das gesuchte Lied nicht dabei, such genauer.
        </div>
      )}
    </div>
  );
}
