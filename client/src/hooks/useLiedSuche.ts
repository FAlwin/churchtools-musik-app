/**
 * **Ein Suchfeld, mehrere Quellen** (#378, Wunsch Alwin: „links Bibliothek, daneben dann SongSelect").
 *
 * Vorbilder sind ProPresenter und WorshipTools Planning: Der Suchbegriff gehört dem Nutzer, die Quelle
 * ist eine Umschaltung daneben – **kein zweiter Dialog**. Vorher war das Nachschlagen im eigenen Bestand
 * ein anderer Weg als das Anlegen aus SongSelect, jeder mit eigenem Suchfeld.
 *
 * **Was hier liegt, sind die Regeln – nicht der Suchtext.** Der Text bleibt beim Aufrufer (in
 * `useSongFilter`, das ohnehin lokal filtert): Zwei Zustände für denselben Text wären zwei Stellen, die
 * auseinanderlaufen. Dieser Hook beantwortet nur: **welche Quelle gilt, und was wird an sie geschickt?**
 *
 * Die drei Quellen sind unterschiedlich teuer, und daran hängt die ganze Mechanik:
 *
 *  - **Bibliothek** filtert lokal im Browser. Kostet nichts, läuft bei jedem Tastendruck.
 *  - **Liedtexte** braucht serverseitig einen Index über alle Liedtexte – **ein Datei-Download je Lied**
 *    beim ersten Mal. Deshalb erst ab `LIEDTEXT_SUCHE_MIN_ZEICHEN`, und entprellt.
 *  - **SongSelect** geht über ChurchTools weiter zu CCLI (~800 ms gemessen). Entprellt, und erst wenn
 *    die Eingabe „reif" ist (`automatischSuchen`) – eine CCLI-Nummer also erst vollständig.
 */
import { useEffect, useState } from 'react';
import { LIEDTEXT_SUCHE_MIN_ZEICHEN } from '@shared/types/index';
import { useEntprellt } from './useEntprellt';
import { SONGSELECT_MIN_ZEICHEN } from './useServices';
import { automatischSuchen } from '../utils/liedFormular';

export type LiedQuelle = 'bibliothek' | 'liedtext' | 'songselect';

/**
 * Die Beschriftungen der Reiter.
 *
 * „Bibliothek" statt „Lieder" (Entscheidung Alwin, 14.08.2026): Neben „SongSelect" wäre „Lieder" blass –
 * dort stehen ja auch Lieder. „Bibliothek" ist der Begriff, den ProPresenter und WorshipTools ebenfalls
 * benutzen, und er sagt: **unser** Bestand.
 */
export const QUELLE_BESCHRIFTUNG: Record<LiedQuelle, string> = {
  bibliothek: 'Bibliothek',
  liedtext: 'Liedtexte',
  songselect: 'SongSelect',
};

/**
 * Wie lange nach dem letzten Tastendruck gewartet wird, bevor eine **teure** Quelle gefragt wird.
 *
 * Stand vorher in `NewSongSheet`. Ohne Entprellung löst „Wo ich auch stehe" fünfzehn CCLI-Suchen aus,
 * von denen vierzehn niemand sehen will – und alle belasten die Gegenstelle (#300).
 */
export const SUCH_ENTPRELLUNG_MS = 400;

interface Optionen {
  /** Der Inhalt des Suchfelds. Liegt beim Aufrufer, damit es ihn nur einmal gibt. */
  eingabe: string;
  /** Hat die Gemeinde die SongSelect-Lizenz? (`canUseCcli` aus den Rechten) */
  canUseCcli: boolean;
  /**
   * Kann aus einem SongSelect-Treffer an dieser Stelle überhaupt ein Lied werden?
   *
   * **Ohne diesen Weg darf der Reiter nicht erscheinen.** In „Lied verknüpfen" (`ItemActionSheet`) wird
   * einem **vorhandenen** Ablaufpunkt ein Lied zugeordnet; ein neu angelegtes Lied müsste dort in diesen
   * Punkt hineingeschrieben werden, was der Anlege-Weg nicht kann. Ein Reiter dorthin wäre eine
   * Sackgasse – genau das, was `NewSongSheet` schon bei fehlender Lizenz vermeidet.
   */
  kannAnlegen: boolean;
}

export function useLiedSuche({ eingabe, canUseCcli, kannAnlegen }: Optionen) {
  const [gewaehlt, setQuelle] = useState<LiedQuelle>('bibliothek');
  const entprellt = useEntprellt(eingabe, SUCH_ENTPRELLUNG_MS).trim();

  /**
   * Welche Quellen es hier gibt. „Bibliothek" und „Liedtexte" immer – beide lesen nur den eigenen
   * Bestand. „SongSelect" nur mit Lizenz **und** einem Weg zum Anlegen.
   */
  const quellen: LiedQuelle[] = ['bibliothek', 'liedtext'];
  if (canUseCcli && kannAnlegen) quellen.push('songselect');

  /**
   * Die **geltende** Quelle – abgeleitet, nicht in einem Effekt korrigiert.
   *
   * Beim ersten Rendern sind die Rechte noch nicht geladen; „SongSelect" fehlt dann in `quellen`. Wäre
   * die Quelle rein aus dem Zustand gelesen, könnte man auf einem Reiter stehen, den es nicht (mehr)
   * gibt – etwa wenn die Lizenz in ChurchTools wegfällt. Dann gilt wieder die Bibliothek.
   *
   * Die App hat sich an genau dieser Sorte Zustand schon einmal verbrannt (#283): Nach einer
   * Zusammenlegung war die Reihenfolge der Setter plötzlich bedeutsam, und ein Menüpunkt tat still
   * nichts mehr. Ein abgeleiteter Wert kann das nicht.
   */
  const quelle: LiedQuelle = quellen.includes(gewaehlt) ? gewaehlt : 'bibliothek';

  /**
   * Was zuletzt **an SongSelect abgeschickt** wurde – nicht, was im Feld steht.
   *
   * Zwei Wege setzen es: die automatische Suche beim Tippen (unten) und der Knopf „Suchen/Abfragen"
   * (`jetztSuchen`). Ein einzelner Zustand mit zwei Quellen ist hier richtig – zwei Zustände, von denen
   * der „neuere" gilt, wären nicht entscheidbar.
   *
   * Die Meldungen nennen immer **diesen** Begriff, nicht die laufende Eingabe: „147 Treffer zu ‚Gnade'"
   * bleibt wahr, während schon das nächste Wort getippt wird.
   */
  const [songSelectBegriff, setSongSelectBegriff] = useState('');

  useEffect(() => {
    /**
     * **Nur, wenn SongSelect auch angezeigt wird.** Sonst löst ein Reiterwechsel – oder schon das Tippen
     * in der Bibliothek – eine CCLI-Anfrage aus, die niemand wollte.
     *
     * `quelle` steht mit in den Abhängigkeiten, und das ist Absicht: Wer „Gnade" in der Bibliothek
     * getippt hat und dann auf SongSelect schaltet, will Ergebnisse sehen, ohne noch einen Buchstaben
     * zu tippen. Ist die Eingabe dagegen nicht reif (eine dreistellige Zahl), passiert weiter nichts –
     * dafür gibt es den Knopf.
     */
    if (quelle !== 'songselect') return;
    if (automatischSuchen(entprellt, SONGSELECT_MIN_ZEICHEN)) setSongSelectBegriff(entprellt);
  }, [entprellt, quelle]);

  /**
   * Was **im Liedtext** gesucht wird – abgeleitet, weil es keine zweite Auslösung gibt.
   *
   * Anders als bei SongSelect kann man hier nichts „trotzdem" abschicken: Unter der Mindestlänge trifft
   * ein Begriff fast jedes Lied. Und die Schwelle schützt vor allem den ersten Aufruf, der den Index
   * baut – **ein Tipp auf den Reiter allein löst also nichts aus**, es braucht einen Begriff.
   */
  const liedtextBegriff =
    quelle === 'liedtext' && entprellt.length >= LIEDTEXT_SUCHE_MIN_ZEICHEN ? entprellt : '';

  /**
   * Sofort bei SongSelect abfragen (Knopf oder Eingabetaste).
   *
   * Wartet die Entprellung nicht ab und erlaubt auch das, was die automatische Regel zurückhält – eine
   * kurze CCLI-Nummer etwa. Die Schwelle ist eine Beobachtung an einem Bestand, kein Gesetz von CCLI,
   * und darf niemandem den Weg versperren.
   */
  const jetztSuchen = (): void => setSongSelectBegriff(eingabe.trim());

  return {
    quelle,
    setQuelle,
    quellen,
    songSelectBegriff,
    liedtextBegriff,
    jetztSuchen,
    /** Steht in der Bibliothek – der Aufrufer zeigt dann seine eigene, lokal gefilterte Liste. */
    inBibliothek: quelle === 'bibliothek',
  };
}
