import type { HeadInfoPart } from '../utils/activeSongView';
import { BpmPulse } from './BpmPulse';
import { Icon } from './icons';
import styles from '../pages/ChordChart.module.scss';

/**
 * Die Kopfzeile der Lied-Anzeige (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Links zurück, mittig der Lied-Knopf mit Info-Zeile, rechts die Werkzeuge. Welche Werkzeuge
 * überhaupt erscheinen, hängt an drei Zuständen, die sich gegenseitig ausschließen:
 *
 *  - **Ein Dokument statt Akkorden** → „Aussehen" und Team-Notizen entfallen; beide wirken auf den
 *    ChordPro-Satz, den es hier nicht gibt.
 *  - **Fremde Notizen ansehen** → Titel-Menü und Stift sind gesperrt. Man sieht gerade nicht die
 *    eigene Ebene; ein Strich würde dort landen, wo man ihn nicht erwartet.
 *  - **Reingezoomt** → nur dann gibt es überhaupt etwas zurückzusetzen.
 */
interface ChartHeaderProps {
  songTitle: string;
  /** Info-Zeile aus `deriveActiveSongView` – reine Daten, die Klassen setzt diese Komponente. */
  headInfo: HeadInfoPart[];
  /** Lied-Menü offen (für `aria-expanded`). */
  menuOpen: boolean;
  appearanceOpen: boolean;
  /** Es werden gerade fremde Notizen angesehen. */
  viewing: boolean;
  /** Statt der Akkorde wird ein hochgeladenes Dokument gezeigt. */
  showsDocument: boolean;
  canUseGlobalNotes: boolean;
  drawMode: boolean;
  /** Eine sichtbare Seite ist reingezoomt. */
  zoomed: boolean;
  /** Läuft der Tempo-Puls? (#145) – färbt den Punkt neben der Tempo-Angabe. */
  bpmPulse: boolean;
  /**
   * EINGESTELLTES Tempo (aus dem Tempo-Menü). Weicht es vom gespeicherten ab, gilt es hier: Anzeige
   * und Puls folgen dem, was gerade eingestellt ist – sonst zeigte die Kopfzeile eine Zahl und der
   * Puls schlüge eine andere. `null` heißt „wie im Lied".
   */
  pulsBpm: number | null;
  /** Ist das Tempo-Menü offen? */
  tempoOpen: boolean;
  /** Läuft irgendetwas Tempo-Bezogenes (Puls oder Klick)? Färbt den Metronom-Knopf. */
  tempoAktiv: boolean;
  onToggleTempo: () => void;
  onBack: () => void;
  onToggleMenu: () => void;
  onToggleAppearance: () => void;
  onResetZoom: () => void;
  onToggleTeamNotes: () => void;
  onToggleDraw: () => void;
}

export function ChartHeader({
  songTitle,
  headInfo,
  menuOpen,
  appearanceOpen,
  viewing,
  showsDocument,
  canUseGlobalNotes,
  drawMode,
  zoomed,
  bpmPulse,
  pulsBpm,
  tempoOpen,
  tempoAktiv,
  onToggleTempo,
  onBack,
  onToggleMenu,
  onToggleAppearance,
  onResetZoom,
  onToggleTeamNotes,
  onToggleDraw,
}: ChartHeaderProps) {
  return (
    <div className={styles.hdr}>
      <button className={styles.ibtn} onClick={onBack} aria-label="Zurück">
        <Icon name="chev-left" size={22} stroke={2.4} />
      </button>
      <div className={styles.center}>
        <button
          className={styles.menuBtn}
          data-tour="chart-lied"
          onClick={() => !viewing && onToggleMenu()}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className={styles.menuTitleRow}>
            <span className={styles.songTitle}>{songTitle}</span>
            <span className={styles.menuChevron} aria-hidden="true">
              ▾
            </span>
          </span>
          {headInfo.length > 0 && (
            <span className={styles.menuInfo}>
              {headInfo.map((part, i) => (
                <span key={i} className={styles.menuInfoPart}>
                  {i > 0 && <span className={styles.menuInfoDot}>·</span>}
                  {part.art === 'key' && <span className={styles.infoKey}>{part.text}</span>}
                  {part.art === 'capo' && <span className={styles.infoCapo}>{part.text}</span>}
                  {part.art === 'bpm' && (
                    <>
                      <Icon
                        name="metronome"
                        size={15}
                        stroke={1.9}
                        className={styles.infoMetronom}
                      />
                      {pulsBpm ?? part.bpm}
                      {/* Der Puls läuft mit dem EINGESTELLTEN Tempo, nicht mit dem gespeicherten –
                          sonst tickte es anders, als das Menü anzeigt, sobald man eins antippt. */}
                      <BpmPulse bpm={pulsBpm ?? part.bpm} active={bpmPulse} />
                    </>
                  )}
                  {part.art === 'plain' && part.text}
                </span>
              ))}
            </span>
          )}
        </button>
      </div>
      <div className={styles.right}>
        {!showsDocument && !viewing && (
          <button
            className={`${styles.toolBtn}${appearanceOpen ? ' ' + styles.on : ''}`}
            data-tour="chart-aussehen"
            onClick={onToggleAppearance}
            title="Aussehen"
          >
            Aa
          </button>
        )}
        {/* Tempo (#145) – öffnet das Menü mit Puls, Klick und Tempo-Antippen. Beschriftung ist wie
            bei „Aa" reiner Text, kein Symbol; der Puls selbst sitzt unten bei der Tempo-Angabe.
            **Bewusst auch ohne gepflegtes Tempo sichtbar:** Genau dann will man eins antippen und
            speichern. Der Knopf färbt sich, wenn Puls oder Klick laufen – nicht schon, wenn nur
            das Menü offen ist; sonst sagt die Farbe zweierlei. */}
        {!viewing && (
          <button
            className={`${styles.toolBtn}${tempoAktiv ? ' ' + styles.on : ''}`}
            data-tour="chart-tempo"
            onClick={onToggleTempo}
            title="Tempo"
            aria-label="Tempo: Puls, Klick und Tempo antippen"
            aria-expanded={tempoOpen}
          >
            <Icon name="metronome" size={20} stroke={1.9} />
          </button>
        )}
        {zoomed && (
          <button
            className={styles.toolBtn}
            onClick={onResetZoom}
            title="Zoom zurücksetzen"
            aria-label="Zoom zurücksetzen"
          >
            <Icon name="zoom-reset" size={18} stroke={2} />
          </button>
        )}
        {/* Team-Notizen: geteilte Anmerkungen anderer ansehen (nur Berechtigte). */}
        {canUseGlobalNotes && !showsDocument && (
          <button
            className={`${styles.toolBtn}${viewing ? ' ' + styles.on : ''}`}
            data-tour="chart-team"
            onClick={onToggleTeamNotes}
            title="Notizen von …"
            aria-label="Notizen von anderen ansehen"
          >
            <Icon name="people" size={18} stroke={2} />
          </button>
        )}
        {!viewing && (
          <button
            className={`${styles.toolBtn}${drawMode ? ' ' + styles.on : ''}`}
            data-tour="chart-anmerken"
            onClick={onToggleDraw}
            title="Anmerkungen"
          >
            <Icon name="pencil" size={18} stroke={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
