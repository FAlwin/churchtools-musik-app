/**
 * „Neues Lied" – ein Lied in ChurchTools anlegen (#322, Schritt 10b).
 *
 * **Zwei gleichrangige Wege** (Entscheidung Alwin, 13.08.2026): bei CCLI SongSelect suchen und das
 * Formular ausgefüllt bekommen, oder alles selbst eintippen. Der zweite ist kein Notausgang – eigene
 * Lieder und Übersetzungen stehen nicht bei CCLI, und ohne die SongSelect-Lizenz gibt es den ersten
 * Weg gar nicht.
 *
 * **Die Kategorie ist Pflicht und wird nicht vorbelegt.** Die App bietet an, was das
 * ChurchTools-Recht hergibt (der Server schneidet die Liste zu), und entscheidet nichts vor.
 *
 * Was hier **nicht** geprüft wird: das Recht und die doppelte CCLI-Nummer. Das macht der Server
 * (`songErstellen.ts`) – eine Prüfung, die nur in der Oberfläche steht, umgeht jeder, der den
 * Endpunkt direkt aufruft. Angezeigt wird seine Meldung.
 */
import { useState } from 'react';
import type { SongSelectTreffer } from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import { CenterMessage } from './CenterMessage';
import {
  SONGSELECT_MIN_ZEICHEN,
  useCapabilities,
  useSongCategories,
  useSongLibrary,
  useSongSelectSuche,
} from '../hooks/useServices';
import { useNeuesLied } from '../hooks/useNeuesLied';
import {
  LEERES_FORMULAR,
  formularAusTreffer,
  formularBereit,
  namensWarnung,
  trefferUnterzeile,
  type NeuesLiedFormular,
} from '../utils/neuesLied';
import { getSongSelectSong } from '../services/churchtoolsApi';
import styles from './NewSongSheet.module.scss';

interface NewSongSheetProps {
  /** Wenn gesetzt: das Lied wird zusätzlich in den Ablauf dieses Termins eingetragen. */
  eventId?: number;
  /** Name des Termins – nur für den Satz in der Erfolgsansicht. */
  eventName?: string;
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

type Schritt = 'weg' | 'suche' | 'formular';

export function NewSongSheet({ eventId, eventName, onOpenSong, onClose }: NewSongSheetProps) {
  const caps = useCapabilities(true);
  const canUseCcli = caps.data?.canUseCcli ?? false;
  const kategorien = useSongCategories(true);
  // Nur für die Warnung bei gleichem Namen. Die Liste ist beim Öffnen längst geladen (Liederheft und
  // Lied-Auswahl nutzen dieselbe Query) – deshalb kein zusätzlicher Abruf gegen ChurchTools.
  const bibliothek = useSongLibrary(true);

  const [schrittGewaehlt, setSchrittGewaehlt] = useState<Schritt | null>(null);
  /**
   * Ohne SongSelect-Lizenz beginnt das Blatt direkt beim Formular – ein Weg, den es nicht gibt, wäre
   * eine Sackgasse. Abgeleitet statt in einem Effekt gesetzt: Beim ersten Rendern sind die Rechte
   * vielleicht noch nicht da, und ein Anfangszustand aus einem `false` wäre dann falsch.
   */
  const schritt: Schritt = schrittGewaehlt ?? (canUseCcli ? 'weg' : 'formular');

  const [formular, setFormular] = useState<NeuesLiedFormular>(LEERES_FORMULAR);
  /** Der übernommene CCLI-Treffer – entscheidet mit, ob ein Notenblatt zu holen ist. */
  const [treffer, setTreffer] = useState<SongSelectTreffer | null>(null);

  /** Der abgeschickte Suchbegriff. Getippt wird in `eingabe` – gesucht erst auf Enter/Knopf. */
  const [eingabe, setEingabe] = useState('');
  const [begriff, setBegriff] = useState('');
  const suche = useSongSelectSuche(begriff, schritt === 'suche');
  /** Läuft die Einzelabfrage für das Copyright? Nur dafür, nicht fürs Anlegen. */
  const [holtDetails, setHoltDetails] = useState(false);

  const neuesLied = useNeuesLied({ eventId, canUseCcli });
  const ergebnis = neuesLied.ergebnis;

  const setzeFeld = (feld: keyof NeuesLiedFormular, wert: string): void =>
    setFormular((f) => ({ ...f, [feld]: wert }));

  /**
   * Einen Treffer übernehmen – und dabei **das Copyright nachholen.**
   *
   * Die Trefferliste von CCLI enthält es nicht; erst die Abfrage per Nummer liefert es. Scheitert sie,
   * geht es ohne weiter: Ein fehlendes Copyright ist kein Grund, das Anlegen zu verhindern.
   */
  async function trefferUebernehmen(t: SongSelectTreffer): Promise<void> {
    setTreffer(t);
    setFormular((f) => formularAusTreffer(t, f));
    setSchrittGewaehlt('formular');

    setHoltDetails(true);
    try {
      const voll = await getSongSelectSong(t.songNumber);
      setTreffer(voll);
      setFormular((f) => formularAusTreffer(voll, f));
    } catch {
      /* Copyright bleibt leer – der Rest steht schon im Formular. */
    } finally {
      setHoltDetails(false);
    }
  }

  const kategorieListe = kategorien.data ?? [];
  const warnung = namensWarnung(formular.name, bibliothek.data ?? []);
  const bereit = formularBereit(formular) && kategorieListe.length > 0;

  const titel = ergebnis
    ? 'Lied angelegt'
    : schritt === 'suche'
      ? 'Bei CCLI suchen'
      : schritt === 'formular'
        ? 'Neues Lied'
        : 'Neues Lied anlegen';

  /* ---------------------------------------------------------------- Erfolgsansicht */

  if (ergebnis) {
    return (
      <Sheet title={titel} onClose={onClose} cancelLabel="Fertig">
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
              setTreffer(null);
              setEingabe('');
              setBegriff('');
              setSchrittGewaehlt(canUseCcli ? 'weg' : 'formular');
            }}
          >
            Noch ein Lied anlegen
          </button>
        </div>
      </Sheet>
    );
  }

  /* --------------------------------------------------------------------- Wegwahl */

  if (schritt === 'weg') {
    return (
      <Sheet title={titel} onClose={onClose}>
        <div className={styles.choices}>
          <button className={styles.choice} onClick={() => setSchrittGewaehlt('suche')}>
            <Icon name="search" size={20} className={styles.choiceIcon} />
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>Bei CCLI suchen</span>
              <span className={styles.choiceMeta}>
                Titel, Autoren und Tonart kommen mit – das Notenblatt auch
              </span>
            </span>
          </button>
          <button className={styles.choice} onClick={() => setSchrittGewaehlt('formular')}>
            <Icon name="type" size={20} className={styles.choiceIcon} />
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>Selbst eintippen</span>
              <span className={styles.choiceMeta}>
                Für eigene Lieder, Übersetzungen und alles, was nicht bei CCLI steht
              </span>
            </span>
          </button>
        </div>
      </Sheet>
    );
  }

  /* ----------------------------------------------------------------------- Suche */

  if (schritt === 'suche') {
    const liste = suche.data ?? [];
    return (
      <Sheet title={titel} onClose={onClose}>
        <div className={styles.searchRow}>
          <input
            className={styles.input}
            placeholder="Liedtitel …"
            value={eingabe}
            autoFocus
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setBegriff(eingabe);
            }}
          />
          <button
            className={styles.primary}
            onClick={() => setBegriff(eingabe)}
            disabled={eingabe.trim().length < SONGSELECT_MIN_ZEICHEN}
          >
            Suchen
          </button>
        </div>

        {suche.isLoading && <CenterMessage loading text="Wird bei CCLI gesucht…" />}

        {/* Der Grund kommt vom Server: fehlende Lizenz klingt anders als ein Aussetzer (#270). */}
        {suche.isError && (
          <div className={styles.err}>
            {suche.error instanceof Error
              ? suche.error.message
              : 'Die Suche bei CCLI ist fehlgeschlagen.'}
          </div>
        )}

        {begriff !== '' && !suche.isLoading && !suche.isError && liste.length === 0 && (
          <div className={styles.hint}>
            Keine Treffer bei CCLI. Vielleicht ist es ein eigenes Lied – dann selbst eintippen.
          </div>
        )}

        {liste.map((t) => (
          <button
            key={t.songNumber}
            className={styles.pickRow}
            onClick={() => void trefferUebernehmen(t)}
          >
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>{t.title}</span>
              <span className={styles.choiceMeta}>{trefferUnterzeile(t)}</span>
            </span>
            <Icon name="chev-right" size={18} stroke={2.2} className={styles.choiceIcon} />
          </button>
        ))}

        {/* Blättern gibt es bei ChurchTools nicht: Es holt 100 Treffer und zeigt keinen Weg weiter.
            Die Liste tut deshalb nicht so, als wäre sie vollständig (gemessen: 147 zu „Wo ich auch
            stehe"). */}
        {liste.length >= 100 && (
          <div className={styles.hint}>
            CCLI liefert höchstens 100 Treffer. Ist das gesuchte Lied nicht dabei, such genauer.
          </div>
        )}

        <button className={styles.secondaryWide} onClick={() => setSchrittGewaehlt('formular')}>
          Stattdessen selbst eintippen
        </button>
      </Sheet>
    );
  }

  /* -------------------------------------------------------------------- Formular */

  return (
    <Sheet title={titel} onClose={onClose}>
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
        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>Liedname</span>
            <input
              className={styles.input}
              placeholder="Titel des Liedes"
              value={formular.name}
              maxLength={LIED_GRENZEN.name.max}
              autoFocus
              onChange={(e) => setzeFeld('name', e.target.value)}
            />
            {/* Gleiche Namen sind erlaubt – gewarnt wird trotzdem, damit niemand versehentlich ein
                Doppel anlegt. Blockiert wird nur die gleiche CCLI-Nummer, und zwar am Server. */}
            {warnung && <span className={styles.warn}>{warnung}</span>}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Kategorie</span>
            <div className={styles.chips}>
              {kategorieListe.map((k) => (
                <button
                  key={k.id}
                  className={`${styles.chip}${formular.categoryId === k.id ? ' ' + styles.chipActive : ''}`}
                  aria-pressed={formular.categoryId === k.id}
                  onClick={() => setFormular((f) => ({ ...f, categoryId: k.id }))}
                >
                  {k.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Tonart</span>
            <input
              className={styles.input}
              placeholder="z. B. E"
              value={formular.key}
              maxLength={LIED_GRENZEN.key}
              onChange={(e) => setzeFeld('key', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Autor</span>
            <input
              className={styles.input}
              placeholder="Optional"
              value={formular.author}
              maxLength={LIED_GRENZEN.author}
              onChange={(e) => setzeFeld('author', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>CCLI-Nummer</span>
            <input
              className={styles.input}
              placeholder="Optional"
              inputMode="numeric"
              value={formular.ccli}
              maxLength={LIED_GRENZEN.ccli}
              onChange={(e) => setzeFeld('ccli', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Copyright</span>
            <textarea
              className={styles.textarea}
              placeholder={holtDetails ? 'Wird von CCLI geholt …' : 'Optional'}
              rows={2}
              value={formular.copyright}
              maxLength={LIED_GRENZEN.copyright}
              onChange={(e) => setzeFeld('copyright', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Name des Arrangements</span>
            <input
              className={styles.input}
              placeholder="Standard"
              value={formular.arrangementName}
              maxLength={LIED_GRENZEN.arrangementName}
              onChange={(e) => setzeFeld('arrangementName', e.target.value)}
            />
          </div>

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
