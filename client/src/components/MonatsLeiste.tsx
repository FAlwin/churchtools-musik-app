import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { monatKurz, monatNurKurz, monatVon, monateAb } from '../utils/monate';
import styles from './MonatsLeiste.module.scss';

interface MonatsLeisteProps {
  /** `YYYY-MM-DD` – bestimmt den laufenden Monat. */
  heute: string;
  /** Der gewählte Monat, `YYYY-MM`. */
  monat: string;
  onMonat: (monat: string) => void;
  /** Monate (`YYYY-MM`), in denen etwas eingetragen ist – bekommen im Raster einen roten Punkt. */
  markiert: ReadonlySet<string>;
  /** Wie viele Monate die Pills voraus zeigen (zusätzlich zum laufenden). */
  voraus?: number;
  /** Wie viele Monate das aufgeklappte Raster zeigt (ab dem laufenden). */
  rasterMonate?: number;
}

/**
 * Die Monatsleiste der Abwesenheiten (#177) – Ergebnis der Entwurfsrunden 4–8 mit Alwin (19.09.2026):
 *
 *  - **Nur nach vorn.** Laufender Monat plus sechs voraus; Vergangenes steht unter „Einträge → Früher".
 *  - **„Heute"** links springt zum laufenden Monat zurück und ist ausgegraut, solange man dort ist.
 *  - **Erkennbar scrollbar:** rechte Kante läuft aus, letzte Pill angeschnitten (`MonatsLeiste.module.scss`).
 *  - **Aufklappen statt nachladen:** Der runde Knopf rechts öffnet ein Raster mit zwölf Monaten ab
 *    heute – „nicht ganz nach unten scrollen müssen" war der Wunsch. Ein roter Punkt zeigt, wo etwas
 *    eingetragen ist.
 */
export function MonatsLeiste({
  heute,
  monat,
  onMonat,
  markiert,
  voraus = 6,
  rasterMonate = 12,
}: MonatsLeisteProps) {
  const [offen, setOffen] = useState(false);
  const laufend = monatVon(heute);
  const pills = monateAb(heute, voraus + 1);
  if (!pills.includes(monat)) pills.push(monat);
  pills.sort();
  const raster = monateAb(heute, rasterMonate);
  const jahre = [...new Set(raster.map((m) => m.slice(0, 4)))].join(' / ');

  // Die gewählte Pill in Sicht schieben – nach einem Sprung aus dem Raster läge sie sonst rechts außerhalb.
  const pillsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pillsRef.current?.querySelector<HTMLElement>(`[data-monat="${monat}"]`);
    // jsdom kennt scrollIntoView nicht – im Test einfach nichts tun.
    el?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [monat]);

  const waehle = (m: string): void => {
    onMonat(m);
    setOffen(false);
  };

  return (
    <div data-tour="verf-monate">
      <div className={styles.leiste}>
        <button
          className={styles.heute}
          disabled={monat === laufend}
          onClick={() => waehle(laufend)}
        >
          Heute
        </button>
        <div className={styles.wrap}>
          <div className={styles.pills} ref={pillsRef}>
            {pills.map((m) => (
              <button
                key={m}
                data-monat={m}
                className={`${styles.pill}${m === monat ? ' ' + styles.pillAn : ''}`}
                aria-pressed={m === monat}
                onClick={() => waehle(m)}
              >
                {monatKurz(m)}
              </button>
            ))}
          </div>
        </div>
        <button
          className={`${styles.auf}${offen ? ' ' + styles.aufAn : ''}`}
          aria-label={offen ? 'Monate zuklappen' : 'Weitere Monate'}
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
        >
          <Icon name="chev-down" size={16} stroke={2.4} />
        </button>
      </div>

      {offen && (
        <div className={styles.raster} role="group" aria-label="Monat wählen">
          <div className={styles.jahr}>{jahre}</div>
          <div className={styles.grid}>
            {raster.map((m) => (
              <button
                key={m}
                className={`${styles.zelle}${m === monat ? ' ' + styles.zelleAn : ''}`}
                aria-pressed={m === monat}
                onClick={() => waehle(m)}
              >
                {monatNurKurz(m)}
                {m.slice(5) === '01' ? ` ${m.slice(2, 4)}` : ''}
                {markiert.has(m) && <span className={styles.punkt} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className={styles.hinweis}>Roter Punkt = in diesem Monat ist etwas eingetragen.</div>
        </div>
      )}
    </div>
  );
}
