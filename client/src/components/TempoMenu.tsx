import { useEffect, useRef, useState } from 'react';
import { MAX_BPM, MIN_BPM, isPulsable } from '../utils/bpmPulse';
import { tempoAusTipps } from '../utils/tapTempo';
import { Icon } from './icons';
import type { KlickModus } from '../hooks/useMetronome';
import styles from '../pages/ChordChart.module.scss';

/**
 * Das Tempo-Menü hinter dem Metronom – alles rund ums Tempo an EINER Stelle.
 *
 * **Ein Wert, vier Wege.** Oben steht genau EIN Tempo. Es beginnt bei dem, was in ChurchTools
 * hinterlegt ist, und lässt sich per −/+, per Texteingabe und per Antippen ändern. Vorher standen
 * hier zwei Zahlen nebeneinander (die des Lieds und die angetippte), und es war nicht zu erkennen,
 * welche gerade gilt. Jetzt gilt immer die eine – Puls und Klick laufen mit ihr, sodass man ein
 * angetipptes Tempo erst **hört** und dann speichert.
 *
 * **Die Trennlinie im Menü ist inhaltlich, nicht optisch:** Oberhalb steht, was nur MIR gehört
 * (Puls und Klick, nichts wird gespeichert). Unterhalb der Speichern-Knopf – der gilt für ALLE, die
 * das Lied öffnen. Deshalb ist er als einziger deutlich markiert.
 *
 * **Der Rahmen ist fest.** Breite fix, Hinweiszeile und Speichern-Knopf sind IMMER da (nur
 * abgeblendet, wenn nichts zu speichern ist). Vorher wuchs das Menü beim Antippen in beide
 * Richtungen und sprang unter dem Finger weg – gemeldet mit zwei Bildschirmfotos.
 */
interface TempoMenuProps {
  /** Tempo, das in ChurchTools steht. Maßstab dafür, ob etwas abweicht. */
  liedTempo: number | null;
  /** Eingestelltes Tempo. `null` heißt „wie im Lied". Damit laufen Puls und Klick. */
  wert: number | null;
  onWert: (bpm: number | null) => void;
  /** Läuft der sichtbare Puls? */
  puls: boolean;
  onPuls: (an: boolean) => void;
  klick: KlickModus;
  onKlick: (modus: KlickModus) => void;
  /** Darf der Nutzer das Tempo in ChurchTools ändern? (gleiche Regel wie beim Bearbeiten) */
  darfSpeichern: boolean;
  /** Speichert das eingestellte Tempo. Meldet, ob es geklappt hat. */
  onSpeichern: (tempo: number) => Promise<void>;
  onClose: () => void;
}

/**
 * Startwert für −/+, wenn weder im Lied noch im Menü ein Tempo steht.
 *
 * 120 ist der Voreinstellwert praktisch jedes Metronoms und liegt in der Mitte dessen, was in
 * Gottesdiensten vorkommt. Von dort sind es in beide Richtungen wenige Tipps – ein Startwert am
 * Rand des Bereichs (20 oder 300) wäre praktisch unbrauchbar.
 */
const START_OHNE_TEMPO = 120;

/** Auf den erlaubten Bereich begrenzen. Die Grenzen kommen aus `@shared/tempo`. */
function begrenzen(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function TempoMenu({
  liedTempo,
  wert,
  onWert,
  puls,
  onPuls,
  klick,
  onKlick,
  darfSpeichern,
  onSpeichern,
  onClose,
}: TempoMenuProps) {
  const gilt = wert ?? liedTempo;
  const abweichend = gilt !== null && gilt !== liedTempo;

  // Die Tipp-Zeitpunkte sind KEIN Zustand: Sie lösen kein Neuzeichnen aus, das ermittelte Tempo
  // schon. In einer Ref bleiben sie über Renders erhalten, ohne bei jedem Tipp zu rendern.
  const tipps = useRef<number[]>([]);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Eigener Zustand fürs Eingabefeld: Beim Tippen entstehen zwischendurch unfertige Eingaben („1",
  // leer, „12"). Würde jede davon sofort nach oben gemeldet, spränge der Puls auf 1 und das Feld
  // ließe sich nicht leeren. Gemeldet wird erst, was im erlaubten Bereich liegt.
  const [eingabe, setEingabe] = useState(gilt === null ? '' : String(gilt));
  const zuletztGezeigt = useRef(gilt);
  useEffect(() => {
    // Von AUSSEN geändert (−/+, Antippen, anderes Lied)? Dann das Feld nachziehen. Bei Änderungen
    // aus dem Feld selbst darf das nicht passieren – sonst würde „07" beim Tippen zu „7".
    if (gilt !== zuletztGezeigt.current) {
      zuletztGezeigt.current = gilt;
      setEingabe(gilt === null ? '' : String(gilt));
    }
  }, [gilt]);

  const setzen = (bpm: number) => {
    const b = begrenzen(bpm);
    zuletztGezeigt.current = b;
    setEingabe(String(b));
    onWert(b);
    setFehler(null);
  };

  const schritt = (d: number) => setzen((gilt ?? START_OHNE_TEMPO) + d);

  const eingetippt = (text: string) => {
    setEingabe(text);
    const n = Number(text);
    if (text.trim() !== '' && Number.isInteger(n) && n >= MIN_BPM && n <= MAX_BPM) {
      zuletztGezeigt.current = n;
      onWert(n);
      setFehler(null);
    }
  };

  // Beim Verlassen aufräumen: Was nicht im Bereich liegt, wird auf den geltenden Wert zurückgesetzt.
  // Ein Feld, in dem „999" stehen bleibt, während gerade 120 klickt, wäre eine Lüge.
  const feldVerlassen = () => setEingabe(gilt === null ? '' : String(gilt));

  const antippen = () => {
    tipps.current = [...tipps.current, performance.now()].slice(-16);
    const t = tempoAusTipps(tipps.current);
    if (t !== null) setzen(t);
  };

  const zuruecksetzen = () => {
    tipps.current = [];
    onWert(null);
    zuletztGezeigt.current = liedTempo;
    setEingabe(liedTempo === null ? '' : String(liedTempo));
    setFehler(null);
  };

  const speichern = async () => {
    if (gilt === null) return;
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern(gilt);
      tipps.current = [];
      onClose();
    } catch (e) {
      // Der Fehler bleibt stehen und das Menü offen – das eingestellte Tempo ist Arbeit, die nicht
      // verloren gehen darf, nur weil ChurchTools kurz nicht wollte (#270).
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSpeichert(false);
    }
  };

  const laeuftDauerhaft = klick === 'dauerhaft';
  const tonMoeglich = isPulsable(gilt);

  /** Was unter der Trennlinie steht. Immer EINE Zeile, damit der Rahmen nicht springt. */
  const hinweis = fehler
    ? fehler
    : !darfSpeichern
      ? 'Zum Ändern in ChurchTools fehlt dir die Berechtigung – der Wert gilt nur hier.'
      : abweichend
        ? 'Speichern setzt das Tempo in ChurchTools – für alle, die dieses Lied öffnen.'
        : 'Puls und Klick gelten nur für dich – gespeichert wird davon nichts.';

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={`${styles.appMenu} ${styles.tempoMenu}`}>
        <div className={styles.menuLblRow}>
          <span className={styles.menuLbl}>Tempo</span>
          <button
            className={styles.menuLink}
            onClick={zuruecksetzen}
            disabled={!abweichend}
            title="Zurück auf das Tempo aus ChurchTools"
          >
            Zurücksetzen
          </button>
        </div>
        <div className={styles.tempoRow}>
          <button
            className={styles.iconBtn}
            onClick={() => schritt(-1)}
            aria-label="Tempo verringern"
          >
            <Icon name="minus" size={20} stroke={2.2} />
          </button>
          <input
            className={styles.tempoInput}
            type="text"
            inputMode="numeric"
            value={eingabe}
            onChange={(e) => eingetippt(e.target.value)}
            onBlur={feldVerlassen}
            aria-label={`Tempo in Schlägen je Minute (${MIN_BPM} bis ${MAX_BPM})`}
            placeholder="–"
          />
          <button className={styles.iconBtn} onClick={() => schritt(1)} aria-label="Tempo erhöhen">
            <Icon name="plus" size={20} stroke={2.2} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={antippen}
            aria-label="Tempo antippen – im Takt mittippen"
            title="Im Takt mittippen"
          >
            <Icon name="tap" size={20} stroke={1.9} />
          </button>
        </div>

        <div className={styles.menuLbl}>Sichtbarer Puls</div>
        <div className={styles.segGroup}>
          <button
            className={`${styles.segBtn}${!puls ? ' ' + styles.on : ''}`}
            onClick={() => onPuls(false)}
          >
            Aus
          </button>
          <button
            className={`${styles.segBtn}${puls ? ' ' + styles.on : ''}`}
            onClick={() => onPuls(true)}
            disabled={!tonMoeglich}
          >
            An
          </button>
        </div>

        <div className={styles.menuLbl}>Klick</div>
        <div className={styles.segGroup}>
          {/* Ein Knopf, der seinen Zustand zeigt: ▶︎ startet, ⏸ hält an. Zwei getrennte Knöpfe für
              Start und Stopp bräuchten mehr Breite und ließen offen, welcher gerade gilt. */}
          <button
            className={`${styles.iconBtn}${laeuftDauerhaft ? ' ' + styles.on : ''}`}
            onClick={() => onKlick(laeuftDauerhaft ? 'aus' : 'dauerhaft')}
            disabled={!tonMoeglich}
            aria-label={laeuftDauerhaft ? 'Klick anhalten' : 'Klick starten'}
            aria-pressed={laeuftDauerhaft}
          >
            <Icon name={laeuftDauerhaft ? 'pause' : 'play'} size={20} stroke={2} />
          </button>
          <button
            className={`${styles.segBtn}${klick === 'einzaehlen' ? ' ' + styles.on : ''}`}
            onClick={() => onKlick(klick === 'einzaehlen' ? 'aus' : 'einzaehlen')}
            disabled={!tonMoeglich}
          >
            Einzählen
          </button>
        </div>

        <div className={`${styles.menuHint}${fehler ? ' ' + styles.menuError : ''}`}>{hinweis}</div>
        <button
          className={styles.menuGo}
          onClick={() => void speichern()}
          disabled={!darfSpeichern || !abweichend || speichert}
        >
          {speichert ? (
            'Speichern…'
          ) : (
            <>
              <Icon name="metronome" size={16} stroke={2} /> {gilt ?? '–'} in ChurchTools speichern
            </>
          )}
        </button>
      </div>
    </>
  );
}
