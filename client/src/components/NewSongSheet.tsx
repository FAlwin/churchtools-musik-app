/**
 * „Neues Lied" – ein Lied in ChurchTools anlegen (#322, Schritt 10b; umgebaut in #378).
 *
 * **Das Blatt ist nur noch das Formular.** Die Wegwahl („Bei SongSelect suchen / Selbst eintippen") und
 * die CCLI-Suche standen hier, bis die Suche in den Einfüge-Dialog wanderte (#378, Entscheidung Alwin, 14.08.2026):
 * Gesucht wird dort im einen Suchfeld; SongSelect steht als Angebot darunter. Ein Treffer öffnet dieses Blatt
 * mit `startTreffer` – vorbelegt, aber noch nicht angelegt.
 *
 * Damit gibt es die SongSelect-Suche **genau einmal**. Zwei Fassungen wären zwei Stellen, an denen jede
 * künftige Korrektur landen müsste, und die zweite wird vergessen – die teuerste Fehlerklasse in diesem
 * Projekt.
 *
 * **Die Kategorie ist Pflicht und wird nicht vorbelegt.** Die App bietet an, was das ChurchTools-Recht
 * hergibt (der Server schneidet die Liste zu), und entscheidet nichts vor. Genau deshalb führt ein
 * SongSelect-Treffer hierher und nicht direkt in ChurchTools.
 *
 * Was hier **nicht** geprüft wird: das Recht und die doppelte CCLI-Nummer. Das macht der Server
 * (`songVerwaltung.ts`) – eine Prüfung, die nur in der Oberfläche steht, umgeht jeder, der den Endpunkt
 * direkt aufruft. Angezeigt wird seine Meldung.
 */
import { useEffect, useState } from 'react';
import type { SongSelectTreffer } from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import { CenterMessage } from './CenterMessage';
import { SongFields } from './SongFields';
// Die Feld-Stile direkt aus dem Modul: Ein Re-Export über die Komponente bricht Fast Refresh.
import feld from './SongFields.module.scss';
import {
  useCapabilities,
  useSongCategories,
  useSongLibrary,
  useSongSelectSong,
} from '../hooks/useServices';
import { useNeuesLied } from '../hooks/useNeuesLied';
import {
  LEERES_FORMULAR,
  formularAusTreffer,
  formularBereit,
  namensWarnung,
  type NeuesLiedFormular,
} from '../utils/liedFormular';
import styles from './NewSongSheet.module.scss';

interface NewSongSheetProps {
  /** Wenn gesetzt: das Lied wird zusätzlich in den Ablauf dieses Termins eingetragen. */
  eventId?: number;
  /** Name des Termins – nur für den Satz in der Erfolgsansicht. */
  eventName?: string;
  /**
   * Ein Treffer aus der Quelle „SongSelect" (#378) – füllt das Formular beim Öffnen.
   *
   * Das Copyright fehlt in der Trefferliste von CCLI und wird nachgeholt (`useSongSelectSong`); der Rest
   * steht sofort da, damit man nicht auf eine Abfrage wartet, die ~800 ms dauert.
   */
  startTreffer?: SongSelectTreffer;
  /**
   * Ein vorbelegter **Titel** – für den Weg „Selbst eintippen" aus der Suche (04.09.2026): Was man ins
   * Suchfeld getippt und nirgends gefunden hat, ist mit hoher Wahrscheinlichkeit der Titel des neuen
   * Liedes. Nochmal tippen wäre eine Zumutung.
   */
  startName?: string;
  /**
   * Öffnet das fertige Lied (Chart-Ansicht) – **optional.**
   *
   * Im Liederheft gibt es diesen Weg; aus dem Ablauf heraus nicht, denn dort steht das Lied nach dem
   * Anlegen ohnehin im Ablauf und ist einen Fingertipp entfernt. Ein „Lied öffnen", das aus dem Ablauf
   * ins Liederheft springt, hätte den Nutzer woanders abgesetzt, als er hergekommen ist.
   */
  onOpenSong?: (songId: number, arrangementId: number) => void;
  onClose: () => void;
}

export function NewSongSheet({
  eventId,
  eventName,
  startTreffer,
  startName,
  onOpenSong,
  onClose,
}: NewSongSheetProps) {
  const caps = useCapabilities(true);
  const canUseCcli = caps.data?.canUseCcli ?? false;
  const kategorien = useSongCategories(true);
  // Nur für die Warnung bei gleichem Namen. Die Liste ist beim Öffnen längst geladen (Liederheft und
  // Lied-Auswahl nutzen dieselbe Query) – deshalb kein zusätzlicher Abruf gegen ChurchTools.
  const bibliothek = useSongLibrary(true);

  /**
   * Der Treffer, der dieses Formular vorbelegt hat – **als Zustand, nicht direkt das Prop.**
   *
   * „Noch ein Lied anlegen" muss ihn loswerden können: Sonst füllte die nachgeholte Abfrage das gerade
   * geleerte Formular wieder mit dem alten Lied.
   */
  const [vorbelegung, setVorbelegung] = useState<SongSelectTreffer | null>(startTreffer ?? null);
  const details = useSongSelectSong(vorbelegung?.songNumber ?? null);
  /**
   * Der vollständigste bekannte Stand des Treffers – **abgeleitet, kein eigener Zustand.**
   *
   * Er entscheidet mit, ob nach dem Anlegen ein Notenblatt zu holen ist (`notenblattPlan`): Die
   * Einzelabfrage weiß, welche Formate CCLI hergibt, der Listentreffer nur das Nötigste.
   */
  const treffer = details.data ?? vorbelegung;

  const [formular, setFormular] = useState<NeuesLiedFormular>(() =>
    startTreffer
      ? formularAusTreffer(startTreffer)
      : startName
        ? { ...LEERES_FORMULAR, name: startName }
        : LEERES_FORMULAR,
  );

  /**
   * Das nachgeholte Copyright ins Formular spiegeln.
   *
   * Hängt an `details.data` und damit an einem Wert, den die Abfrage stabil hält – ein Effekt an einem
   * Prop-Objekt wäre bei jedem Rendern neu gelaufen. Die bereits eingetippten Felder bleiben stehen
   * (`formularAusTreffer` legt nur die Treffer-Felder darüber).
   */
  useEffect(() => {
    const voll = details.data;
    if (voll) setFormular((f) => formularAusTreffer(voll, f));
  }, [details.data]);

  const neuesLied = useNeuesLied({ eventId, canUseCcli });
  const ergebnis = neuesLied.ergebnis;

  const setzeFeld = (feld: keyof NeuesLiedFormular, wert: string): void =>
    setFormular((f) => ({ ...f, [feld]: wert }));

  const kategorieListe = kategorien.data ?? [];
  const warnung = namensWarnung(formular.name, bibliothek.data ?? []);
  const bereit = formularBereit(formular) && kategorieListe.length > 0;

  /* ---------------------------------------------------------------- Erfolgsansicht */

  if (ergebnis) {
    return (
      <Sheet title="Lied angelegt" onClose={onClose} cancelLabel="Fertig">
        <div className={styles.success}>
          <span className={styles.successIcon}>
            <Icon name="check" size={26} stroke={2.6} />
          </span>
          <div>
            „{ergebnis.name}" ist angelegt
            {ergebnis.notenblatt ? ' – mit Notenblatt aus SongSelect' : ''}
            {eventId !== undefined && ergebnis.hinweise.length === 0 && eventName
              ? ` und steht im Ablauf von ${eventName}`
              : ''}
            .
          </div>
        </div>

        {/* Teilerfolge stehen hier als ganze Sätze: Was fehlt, erfährt man jetzt – nicht erst, wenn
            man es vermisst. */}
        {ergebnis.hinweise.map((h) => (
          <div key={h} className={styles.hint}>
            {h}
          </div>
        ))}

        <div className={styles.actions}>
          {onOpenSong && (
            <button
              className={styles.primaryWide}
              onClick={() => onOpenSong(ergebnis.songId, ergebnis.arrangementId)}
            >
              Lied öffnen
            </button>
          )}
          <button
            className={onOpenSong ? styles.secondaryWide : styles.primaryWide}
            onClick={() => {
              neuesLied.zuruecksetzen();
              setFormular(LEERES_FORMULAR);
              // Muss mit zurück: Sonst legte die Abfrage zum alten Treffer das leere Formular wieder voll.
              setVorbelegung(null);
            }}
          >
            Noch ein Lied anlegen
          </button>
        </div>
      </Sheet>
    );
  }

  /* -------------------------------------------------------------------- Formular */

  return (
    <Sheet title="Neues Lied" onClose={onClose}>
      {neuesLied.fehler && <div className={styles.err}>{neuesLied.fehler}</div>}

      {kategorien.isError ? (
        <CenterMessage
          icon="⚠️"
          text="Die Lied-Kategorien konnten nicht geladen werden."
          onRetry={() => void kategorien.refetch()}
        />
      ) : kategorien.isLoading ? (
        <CenterMessage loading text="Kategorien werden geladen…" />
      ) : kategorieListe.length === 0 ? (
        /* Der Admin-Fall aus `ctSongCategories`: ohne freigegebene Kategorie kann ChurchTools kein
           Lied annehmen. Dann ist ein ehrlicher Satz besser als ein Formular, das am Ende abgelehnt
           wird. */
        <div className={styles.hint}>
          In ChurchTools ist dir keine Lied-Kategorie zum Bearbeiten freigegeben. Ohne sie lässt
          sich kein Lied anlegen – das kann ein Administrator ändern.
        </div>
      ) : (
        <div className={feld.form}>
          <SongFields
            formular={formular}
            onFeld={setzeFeld}
            onKategorie={(id) => setFormular((f) => ({ ...f, categoryId: id }))}
            kategorien={kategorieListe}
            warnung={warnung}
            copyrightPlatzhalter={details.isLoading ? 'Wird von SongSelect geholt …' : 'Optional'}
            autoFocus
          >
            {/* Nur beim Anlegen: Beides gehört zum ERSTEN Arrangement, nicht zum Lied. Beim Ändern der
                Stammdaten haben sie deshalb nichts zu suchen. */}
            <div className={feld.field}>
              <span className={feld.label}>Tonart</span>
              <input
                className={feld.input}
                placeholder="z. B. E"
                value={formular.key}
                maxLength={LIED_GRENZEN.key}
                onChange={(e) => setzeFeld('key', e.target.value)}
              />
            </div>

            <div className={feld.field}>
              <span className={feld.label}>Name des Arrangements</span>
              <input
                className={feld.input}
                placeholder="Standard"
                value={formular.arrangementName}
                maxLength={LIED_GRENZEN.arrangementName}
                onChange={(e) => setzeFeld('arrangementName', e.target.value)}
              />
            </div>
          </SongFields>

          {eventId !== undefined && (
            <div className={styles.hint}>
              Das Lied wird zusätzlich in den Ablauf{eventName ? ` von ${eventName}` : ''}{' '}
              eingetragen.
            </div>
          )}

          <button
            className={styles.primaryWide}
            disabled={!bereit || neuesLied.laeuft}
            onClick={() => {
              // `formularBereit` stellt sicher, dass eine Kategorie gewählt ist – deshalb hier kein
              // `?? 0`: Das wäre stillschweigend „Aktive Songs" gewesen.
              if (formular.categoryId === null) return;
              void neuesLied.anlegen(formular, formular.categoryId, treffer);
            }}
          >
            {neuesLied.laeuft
              ? 'Wird angelegt …'
              : neuesLied.ungewiss
                ? 'Trotzdem erneut anlegen'
                : 'Lied anlegen'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
