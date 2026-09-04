/**
 * Der Ablauf „Neues Lied anlegen" (#322, Schritt 10b) – **zwei bis vier Schritte, die einzeln
 * scheitern können.**
 *
 * Anlegen (Lied + Arrangement, serverseitig ein Aufruf), auf Wunsch der Ablauf-Eintrag, danach das
 * Notenblatt aus SongSelect. Warum das ein Hook mit Tests ist und nicht in der Komponente steht: Hier
 * liegen die Regeln, die sich nicht ansehen lassen, ohne sie auszulösen –
 *
 *  - **ein Fehlschlag beim Notenblatt macht das Lied nicht ungültig.** Es existiert; die Oberfläche
 *    muss es öffnen können und trotzdem sagen, was fehlt.
 *  - **nach einem `502` ist der Zustand ungewiss, nicht „nichts passiert".** `schreibe()` meldet 502
 *    sowohl, wenn ChurchTools den Aufruf abgelehnt hat (nichts entstanden), als auch wenn das Lied
 *    entstanden ist und danach etwas schiefging (kein Arrangement, keine ID in der Antwort). Ein
 *    einfaches „Erneut versuchen" wäre hier die Einladung zum Doppel – deshalb verlangt der zweite
 *    Versuch einen zweiten, ausdrücklichen Klick.
 *
 * **Nichts wird automatisch wiederholt** (siehe `songErstellen.ts` und `schreibe()`).
 */
import { useState } from 'react';
import type { SongSelectTreffer } from '@shared/types/index';
import { ApiError } from '../services/api';
import { holeChordProAusSongSelect } from '../services/churchtoolsApi';
import { useLiedAnlegen } from './useServices';
import { auftragAus, notenblattPlan, type NeuesLiedFormular } from '../utils/liedFormular';
import { useNotenblatt } from './useNotenblatt';

/** Was aus dem Anlegen wurde – **einschließlich der Teilerfolge.** */
export interface NeuesLiedErgebnis {
  songId: number;
  arrangementId: number;
  /** Der Name, wie er angelegt wurde – für die Erfolgsmeldung. */
  name: string;
  /** Hat das Lied jetzt ein Notenblatt aus SongSelect? */
  notenblatt: boolean;
  /** Woher das Notenblatt kam – für den Satz in der Erfolgsansicht. */
  notenblattQuelle: 'songselect' | 'eigenes' | null;
  /**
   * Was außerdem gesagt werden muss: Notenblatt nicht geholt, Ablauf-Eintrag fehlgeschlagen.
   *
   * **Sätze, keine Codes** – sie stehen so in der Erfolgsansicht. Ein leeres Feld heißt: alles hat
   * geklappt.
   */
  hinweise: string[];
}

interface Args {
  /** Wenn gesetzt: das Lied zusätzlich in den Ablauf dieses Termins eintragen. */
  eventId?: number;
  /** Darf die Gemeinde CCLI SongSelect nutzen? Ohne das Recht wird kein Notenblatt geholt. */
  canUseCcli: boolean;
}

export function useNeuesLied({ eventId, canUseCcli }: Args) {
  const anlegenMutation = useLiedAnlegen();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /**
   * Nach einem `502`: Der Zustand in ChurchTools ist ungewiss (siehe Kopf). Der Knopf heißt dann
   * „Trotzdem erneut anlegen" – so kann niemand versehentlich ein zweites Lied erzeugen, und wer
   * nachgesehen hat, kommt trotzdem weiter.
   */
  const [ungewiss, setUngewiss] = useState(false);
  const [ergebnis, setErgebnis] = useState<NeuesLiedErgebnis | null>(null);

  /** Setzt alles zurück – für „Noch ein Lied anlegen". */
  const zuruecksetzen = (): void => {
    setFehler(null);
    setUngewiss(false);
    setErgebnis(null);
    notenblatt.zuruecksetzen();
  };

  /* ---------------------------------------------- Notenblatt bearbeiten (Editor nach dem Anlegen) */

  /**
   * **Der Editor nach dem Anlegen** (Wunsch Alwin, 04.09.2026) – als Angebot, nicht als Schritt.
   *
   * Ein selbst eingetipptes Lied war bis dahin nach dem Anlegen leer: Man musste es öffnen, eine
   * Version anlegen, den Text tippen. Jetzt steht in der Erfolgsansicht „Notenblatt schreiben":
   * leerer Editor mit Titel/Tonart/Nummer als ChordPro-Gerüst – oder, wenn SongSelect ein Blatt
   * geliefert hat, genau dieses zum Anpassen. Die Mechanik liegt in `useNotenblatt` – dieselbe wie im
   * Stammdaten-Blatt.
   */
  const notenblatt = useNotenblatt(
    ergebnis ? { songId: ergebnis.songId, arrangementId: ergebnis.arrangementId } : null,
  );

  const notenblattText = (formular: NeuesLiedFormular): Promise<string> =>
    ergebnis
      ? notenblatt.text(
          { title: ergebnis.name, key: formular.key, ccli: formular.ccli },
          ergebnis.notenblatt,
        )
      : Promise.resolve('');

  const notenblattSpeichern = async (text: string): Promise<boolean> => {
    const ok = await notenblatt.speichern(text);
    if (ok && ergebnis) setErgebnis({ ...ergebnis, notenblatt: true, notenblattQuelle: 'eigenes' });
    return ok;
  };

  const anlegen = async (
    formular: NeuesLiedFormular,
    categoryId: number,
    treffer: SongSelectTreffer | null,
  ): Promise<void> => {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    setUngewiss(false);

    try {
      const angelegt = await anlegenMutation.mutateAsync(auftragAus(formular, categoryId, eventId));

      const hinweise: string[] = [];
      // Der Ablauf-Eintrag ist der dritte Schreibvorgang: Sein Fehlschlag ist kein Gesamtfehler, aber
      // er darf auch nicht verschwiegen werden – sonst sucht jemand das Lied im Ablauf umsonst.
      if (eventId !== undefined && angelegt.imAblauf === false) {
        hinweise.push(
          `Das Lied steht noch nicht im Ablauf – das hat nicht geklappt${
            angelegt.ablaufFehler ? `: ${angelegt.ablaufFehler}` : '.'
          }`,
        );
      }

      let notenblatt = false;
      const plan = notenblattPlan(formular, treffer, canUseCcli);
      if (plan && 'grund' in plan) {
        hinweise.push(plan.grund);
      } else if (plan) {
        try {
          await holeChordProAusSongSelect(angelegt.songId, angelegt.arrangementId, plan.songNumber);
          notenblatt = true;
        } catch (e) {
          // Das Lied bleibt bestehen – nur das Blatt fehlt. Der Grund kommt vom Server (Lizenz, Netz),
          // damit klar ist, ob ein zweiter Versuch überhaupt Sinn hat (#270).
          hinweise.push(
            `Das Notenblatt konnte nicht aus SongSelect geholt werden: ${
              e instanceof Error ? e.message : 'unbekannter Fehler'
            } Über „Dateien …" im Lied-Menü lässt es sich nachholen.`,
          );
        }
      }

      setErgebnis({
        songId: angelegt.songId,
        arrangementId: angelegt.arrangementId,
        name: formular.name.trim(),
        notenblatt,
        notenblattQuelle: notenblatt ? 'songselect' : null,
        hinweise,
      });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das Anlegen ist fehlgeschlagen.');
      if (e instanceof ApiError && e.status === 502) setUngewiss(true);
    } finally {
      setLaeuft(false);
    }
  };

  return {
    anlegen,
    laeuft,
    fehler,
    ungewiss,
    ergebnis,
    zuruecksetzen,
    notenblattText,
    notenblattSpeichern,
    notenblattLaeuft: notenblatt.laeuft,
    notenblattFehler: notenblatt.fehler,
  };
}
