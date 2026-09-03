/**
 * Die Trefferliste der Quelle **„SongSelect"** (#378) – vorher inmitten von `NewSongSheet`.
 *
 * Herausgezogen, weil die Suche nicht mehr nur im Anlege-Blatt steht. Seit dem 03.09.2026 erscheint sie
 * als **Gruppe unter der Bibliothek** – deshalb trägt sie eine Überschrift, die die Quelle nennt: Ein
 * SongSelect-Treffer und ein eigenes Lied sehen sonst zum Verwechseln ähnlich aus, führen aber zu ganz
 * Verschiedenem (anlegen vs. einfügen).
 *
 * **Ein Treffer führt ins Anlege-Formular, nicht direkt in ChurchTools** (Entscheidung Alwin,
 * 14.08.2026): Die Kategorie ist Pflicht und wird bewusst nicht vorbelegt – ohne sie kann ChurchTools kein
 * Lied annehmen.
 */
import type { SongSelectTreffer } from '@shared/types/index';
import { useSongSelectSuche } from '../hooks/useServices';
import { QUELLE_BESCHRIFTUNG } from '../hooks/useLiedSuche';
import { sucheArt, trefferUnterzeile } from '../utils/liedFormular';
import { CenterMessage } from './CenterMessage';
import { Icon } from './icons';
import styles from './LiedTreffer.module.scss';

interface SongSelectTrefferListeProps {
  /** Der **abgeschickte** Begriff – nicht der Feldinhalt (`''` = es läuft noch nichts). */
  begriff: string;
  onPick: (treffer: SongSelectTreffer) => void;
  busy?: boolean;
}

export function SongSelectTrefferListe({ begriff, onPick, busy }: SongSelectTrefferListeProps) {
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
        <button
          key={t.songNumber}
          className={styles.zeile}
          disabled={busy}
          onClick={() => onPick(t)}
        >
          <span className={styles.text}>
            <span className={styles.titel}>{t.title}</span>
            <span className={styles.meta}>{trefferUnterzeile(t)}</span>
          </span>
          <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
        </button>
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
