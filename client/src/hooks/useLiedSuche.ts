/**
 * **Ein Suchfeld – die Bibliothek zuerst, die anderen Quellen als Angebot darunter** (#378, zweiter
 * Anlauf nach Alwins Rückmeldung vom 03.09.2026).
 *
 * Der erste Anlauf hatte einen Umschalter „Bibliothek · Liedtexte · SongSelect" **über** der Liste. Das
 * verlangte die Entscheidung, *wo* gesucht wird, **vor** dem Tippen – obwohl man sie erst nach dem
 * Ergebnis treffen kann („ist es bei uns? nein? dann SongSelect"). Jetzt gilt:
 *
 *  1. Die **Bibliothek** filtert beim Tippen, immer. Sie kostet nichts.
 *  2. **Liedtexte** und **SongSelect** sind **Angebote unter der Liste** – ein Tipp, und die Treffer
 *     erscheinen darunter als beschriftete Gruppe. Dasselbe Muster, das das Liederheft für die
 *     Liedtextsuche schon vor #378 hatte; es steht jetzt einmal hier statt zweimal.
 *  3. **Die Ausnahme:** Findet die Bibliothek zu einem reifen Begriff **nichts**, fragt SongSelect von
 *     selbst – dann ist die Anfrage ja nötig. Findet sie etwas, bleibt SongSelect ein Angebot.
 *
 * Warum die Quellen unterschiedlich behandelt werden, hängt an ihren Kosten: Jede SongSelect-Suche geht
 * über ChurchTools weiter an CCLI (~800 ms gemessen, zählt gegen die Drosselung – #300 hat damit die
 * ganze App lahmgelegt). Die Liedtextsuche baut beim ersten Mal einen Index über **einen Download je
 * Lied**. Beides darf nicht bei jedem Tastendruck laufen; deshalb kein „alles auf einmal".
 *
 * **Was hier liegt, sind die Regeln – nicht der Suchtext.** Der Text bleibt beim Aufrufer (in
 * `useSongFilter`, das ohnehin lokal filtert): Zwei Zustände für denselben Text wären zwei Stellen, die
 * auseinanderlaufen.
 */
import { useEffect, useState } from 'react';
import { LIEDTEXT_SUCHE_MIN_ZEICHEN } from '@shared/types/index';
import { useEntprellt } from './useEntprellt';
import { SONGSELECT_MIN_ZEICHEN } from './useServices';
import { automatischSuchen } from '../utils/liedFormular';

/** Die beiden Quellen, die als Gruppe unter der Bibliothek erscheinen – ihre Überschrift. */
export type LiedQuelle = 'liedtext' | 'songselect';

export const QUELLE_BESCHRIFTUNG: Record<LiedQuelle, string> = {
  liedtext: 'Liedtexte',
  songselect: 'SongSelect',
};

/**
 * Wie lange nach dem letzten Tastendruck gewartet wird, bevor eine **teure** Quelle von selbst gefragt
 * wird. Ohne Entprellung löst „Wo ich auch stehe" fünfzehn CCLI-Suchen aus, von denen vierzehn niemand
 * sehen will – und alle belasten die Gegenstelle (#300).
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
   * **Ohne diesen Weg gibt es SongSelect hier nicht.** In „Lied verknüpfen" (`ItemActionSheet`) wird
   * einem **vorhandenen** Ablaufpunkt ein Lied zugeordnet; ein neu angelegtes Lied müsste dort in diesen
   * Punkt hineingeschrieben werden, was der Anlege-Weg nicht kann. Ein Angebot dorthin wäre eine
   * Sackgasse. Im Liederheft ist es ebenso: Dort schlägt man nach, SongSelect hat dort nichts zu suchen.
   */
  kannAnlegen: boolean;
  /**
   * Hat die Bibliothek zum aktuellen Begriff **keinen** Treffer? Der Aufrufer weiß das, weil er filtert.
   * Nur dann fragt SongSelect von selbst.
   */
  bibliothekLeer: boolean;
}

export function useLiedSuche({ eingabe, canUseCcli, kannAnlegen, bibliothekLeer }: Optionen) {
  const begriff = eingabe.trim();
  const entprellt = useEntprellt(eingabe, SUCH_ENTPRELLUNG_MS).trim();
  const songSelectMoeglich = canUseCcli && kannAnlegen;

  /**
   * Was zuletzt **abgeschickt** wurde – je Quelle ein Zustand, nicht der Feldinhalt.
   *
   * Zwei Wege setzen den SongSelect-Begriff: die automatische Suche bei leerer Bibliothek (unten) und
   * das Angebot bzw. die Eingabetaste (`songSelectSuchen`). Ein einzelner Zustand mit zwei Quellen ist
   * hier richtig – zwei Zustände, von denen der „neuere" gilt, wären nicht entscheidbar.
   */
  const [ssAbgeschickt, setSsAbgeschickt] = useState('');
  const [ltAbgeschickt, setLtAbgeschickt] = useState('');

  useEffect(() => {
    /**
     * **Nur bei leerer Bibliothek – und nur, wenn die Eingabe reif ist.** Wer „Gnade" tippt und dazu
     * eigene Lieder hat, bekommt keine CCLI-Anfrage; wer „Wo ich auch stehe" tippt und nichts hat, bekommt
     * sie ohne weiteren Tipp. Eine dreistellige Zahl ist nicht reif (die Nummern haben 7 Stellen) – dafür
     * gibt es das Angebot.
     */
    if (!songSelectMoeglich || !bibliothekLeer) return;
    if (automatischSuchen(entprellt, SONGSELECT_MIN_ZEICHEN)) setSsAbgeschickt(entprellt);
  }, [entprellt, bibliothekLeer, songSelectMoeglich]);

  /**
   * Ein abgeschickter Begriff **gilt nur, solange er noch im Feld steht** – abgeleitet, nicht in einem
   * Effekt zurückgesetzt. Sonst stünden Treffer zu einem Wort da, das längst überschrieben ist. Dieselbe
   * Regel hatte das Liederheft als `textSuche === query`; sie steht jetzt einmal hier.
   */
  const songSelectBegriff =
    songSelectMoeglich && ssAbgeschickt !== '' && ssAbgeschickt === begriff ? ssAbgeschickt : '';
  const liedtextBegriff = ltAbgeschickt !== '' && ltAbgeschickt === begriff ? ltAbgeschickt : '';

  /**
   * Sofort bei SongSelect suchen (Angebot oder Eingabetaste). Wartet die Entprellung nicht ab und erlaubt
   * auch das, was die automatische Regel zurückhält – eine kurze CCLI-Nummer etwa. Die 7 Stellen sind eine
   * Beobachtung an einem Bestand, kein Gesetz von CCLI, und dürfen niemandem den Weg versperren.
   */
  const songSelectSuchen = (): void => {
    if (songSelectMoeglich && begriff.length >= SONGSELECT_MIN_ZEICHEN) setSsAbgeschickt(begriff);
  };

  /**
   * In den Liedtexten suchen – **nur auf Wunsch, nie von selbst.** Unter der Mindestlänge trifft ein
   * Begriff fast jedes Lied, und die Schwelle schützt vor allem den ersten Aufruf, der den Index baut.
   */
  const liedtexteSuchen = (): void => {
    if (begriff.length >= LIEDTEXT_SUCHE_MIN_ZEICHEN) setLtAbgeschickt(begriff);
  };

  return {
    songSelectMoeglich,
    /** `''` = es läuft nichts; sonst der Begriff, zu dem gerade SongSelect-Treffer gehören. */
    songSelectBegriff,
    songSelectSuchen,
    /** Das Angebot zeigen? Nur, wenn es die Quelle gibt, die Eingabe lang genug ist und noch nichts läuft. */
    angebotSongSelect:
      songSelectMoeglich && begriff.length >= SONGSELECT_MIN_ZEICHEN && songSelectBegriff === '',
    /** `''` = es läuft nichts; sonst der Begriff, zu dem gerade Liedtext-Treffer gehören. */
    liedtextBegriff,
    liedtexteSuchen,
    angebotLiedtexte: begriff.length >= LIEDTEXT_SUCHE_MIN_ZEICHEN && liedtextBegriff === '',
  };
}
