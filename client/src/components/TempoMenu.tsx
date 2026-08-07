import { useRef, useState } from 'react';
import { isPulsable } from '../utils/bpmPulse';
import { MIN_TAP_BPM, tempoAusTipps } from '../utils/tapTempo';
import type { KlickModus } from '../hooks/useMetronome';
import styles from '../pages/ChordChart.module.scss';

/**
 * Das Tempo-Menü hinter der ♩ – alles rund ums Tempo an EINER Stelle.
 *
 * Vorher war der Puls ein direkter Schalter. Mit dem hörbaren Klick und dem Antippen wären daraus
 * drei Knöpfe in einer Leiste geworden, die auf dem Handy ohnehin knapp ist. Als Menü bleibt oben
 * ein Knopf, und die drei Dinge stehen beieinander, wo sie hingehören.
 *
 * **Die Trennlinie im Menü ist inhaltlich, nicht optisch:** Oberhalb steht, was nur MIR gehört
 * (Puls und Klick, nichts wird gespeichert). Unterhalb steht das Tempo selbst – und das gilt für
 * ALLE, die das Lied öffnen. Deshalb ist der Speichern-Knopf auch als einziger deutlich markiert
 * und erscheint erst, wenn wirklich ein neues Tempo ermittelt wurde.
 */
interface TempoMenuProps {
  /** Tempo des aktiven Lieds (aus ChurchTools). */
  bpm: number | null;
  /** Läuft der sichtbare Puls? */
  puls: boolean;
  onPuls: (an: boolean) => void;
  klick: KlickModus;
  onKlick: (modus: KlickModus) => void;
  /** Darf der Nutzer das Tempo in ChurchTools ändern? (gleiche Regel wie beim Bearbeiten) */
  darfSpeichern: boolean;
  /** Speichert das angetippte Tempo. Meldet, ob es geklappt hat. */
  onSpeichern: (tempo: number) => Promise<void>;
  onClose: () => void;
}

export function TempoMenu({
  bpm,
  puls,
  onPuls,
  klick,
  onKlick,
  darfSpeichern,
  onSpeichern,
  onClose,
}: TempoMenuProps) {
  // Die Tipp-Zeitpunkte selbst sind KEIN Zustand: Sie lösen kein Neuzeichnen aus, das ermittelte
  // Tempo schon. In einer Ref bleiben sie über Renders erhalten, ohne bei jedem Tipp zu rendern.
  const tipps = useRef<number[]>([]);
  const [getippt, setGetippt] = useState<number | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const antippen = () => {
    tipps.current = [...tipps.current, performance.now()].slice(-16);
    setGetippt(tempoAusTipps(tipps.current));
    setFehler(null);
  };

  const zuruecksetzen = () => {
    tipps.current = [];
    setGetippt(null);
    setFehler(null);
  };

  const speichern = async () => {
    if (getippt === null) return;
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern(getippt);
      zuruecksetzen();
      onClose();
    } catch (e) {
      // Der Fehler bleibt stehen und das Menü offen – das angetippte Tempo ist Arbeit, die nicht
      // verloren gehen darf, nur weil ChurchTools kurz nicht wollte (#270).
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSpeichert(false);
    }
  };

  const modi: { key: KlickModus; label: string }[] = [
    { key: 'aus', label: 'Aus' },
    { key: 'einzaehlen', label: 'Einzählen' },
    { key: 'dauerhaft', label: 'Dauerhaft' },
  ];

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={`${styles.appMenu} ${styles.tempoMenu}`}>
        <div className={styles.menuLbl}>Tempo</div>
        <div className={styles.appRow}>
          <span className={styles.stepValue}>{isPulsable(bpm) ? `♩ ${bpm}` : 'kein Tempo'}</span>
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
            disabled={!isPulsable(bpm)}
          >
            An
          </button>
        </div>

        <div className={styles.menuLbl}>Klick</div>
        <div className={styles.segGroup}>
          {modi.map((m) => (
            <button
              key={m.key}
              className={`${styles.segBtn}${klick === m.key ? ' ' + styles.on : ''}`}
              onClick={() => onKlick(m.key)}
              disabled={!isPulsable(bpm) && m.key !== 'aus'}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className={styles.menuLbl}>Tempo antippen</div>
        <div className={styles.appRow}>
          <button className={styles.stepBtn} onClick={antippen}>
            Tippen
          </button>
          <span className={styles.stepValue}>
            {getippt !== null ? `♩ ${getippt}` : tipps.current.length > 0 ? '…' : '–'}
          </span>
          <button
            className={styles.stepBtn}
            onClick={zuruecksetzen}
            disabled={!tipps.current.length}
          >
            Zurück
          </button>
        </div>

        {getippt !== null && darfSpeichern && (
          <>
            <div className={styles.menuHint}>
              Speichern setzt das Tempo in ChurchTools – für alle, die dieses Lied öffnen.
            </div>
            <button className={styles.menuGo} onClick={() => void speichern()} disabled={speichert}>
              {speichert ? 'Speichern…' : `♩ ${getippt} in ChurchTools speichern`}
            </button>
          </>
        )}
        {getippt !== null && !darfSpeichern && (
          <div className={styles.menuHint}>
            Zum Speichern in ChurchTools fehlt dir die Berechtigung – der Wert gilt nur hier.
          </div>
        )}
        {getippt === null && tipps.current.length > 0 && (
          <div className={styles.menuHint}>
            Weiter im Takt tippen – langsamer als {MIN_TAP_BPM} Schläge lässt sich nicht ermitteln.
          </div>
        )}
        {fehler && <div className={styles.menuError}>{fehler}</div>}
      </div>
    </>
  );
}
