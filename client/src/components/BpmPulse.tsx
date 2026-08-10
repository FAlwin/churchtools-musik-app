import { useEffect, useState } from 'react';
import { beatIndexOfFlash, flashIndexAt, isPulsable } from '../utils/bpmPulse';
import { beatsPerBar, isAccent } from '../utils/metronome';
import styles from './BpmPulse.module.scss';

/**
 * Der lautlose Tempo-Puls neben der Tempo-Angabe (#145).
 *
 * **Eigene Komponente, damit der Takt nicht die ganze Seite neu zeichnet.** Bei 72 bpm ändert sich
 * hier gut einmal pro Sekunde der Zustand; läge er in `ChordChart`, würde jedes Mal das komplette
 * Liederheft neu gerendert.
 *
 * Der Schlag kommt aus `utils/bpmPulse` und wird bei jedem Frame aus der **verstrichenen Zeit**
 * abgeleitet – nicht hochgezählt. Ein verschluckter Frame verschiebt damit höchstens einen Schlag
 * statt alle folgenden.
 *
 * **Weniger Bewegung, aber nicht gar keine:** Wer `prefers-reduced-motion` gesetzt hat, bekommt
 * denselben Takt ohne das Größerwerden – nur die Helligkeit wechselt. Den Puls ganz abzuschalten
 * wäre falsch: Er IST die Funktion, nicht Zierrat, und eine sanfte Helligkeitsänderung ist genau
 * das, was diese Einstellung erlaubt.
 *
 * **Die Eins ist markiert** – größer und kräftiger als die übrigen Schläge. Ohne sie sagt der Puls
 * nur, WIE SCHNELL es geht, nicht WO der Takt anfängt; genau darum geht es beim Einzählen. Der
 * hörbare Klick macht dasselbe mit einem höheren Ton, und beide entscheiden es mit derselben
 * Funktion (`isAccent`), damit sie nicht auseinanderlaufen können.
 *
 * **Der Nullpunkt kommt von außen** (`taktStartMs`): Puls und Klick teilen sich ein Raster. Vorher
 * startete jeder seine eigene Uhr beim Einschalten – wer sie nacheinander anschaltete, hatte zwei
 * Takte nebeneinander.
 */
interface BpmPulseProps {
  /** Tempo des aktiven Lieds. */
  bpm: number | null;
  /** Läuft der Puls gerade? */
  active: boolean;
  /** Nullpunkt des gemeinsamen Takt-Rasters (`performance.now()`-ms). `null` = eigener Start. */
  taktStartMs: number | null;
  /** Taktart des Lieds – entscheidet, welcher Schlag die betonte Eins ist. */
  timeSig: string | null;
}

export function BpmPulse({ bpm, active, taktStartMs, timeSig }: BpmPulseProps) {
  const [flash, setFlash] = useState(0);
  const laeuft = active && isPulsable(bpm);

  useEffect(() => {
    if (!laeuft) return;
    const start = taktStartMs ?? performance.now();
    let handle = 0;
    let letzter = -1;

    const tick = (jetzt: number) => {
      const index = flashIndexAt(jetzt - start, bpm);
      if (index !== letzter) {
        letzter = index;
        setFlash(index);
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [laeuft, bpm, taktStartMs]);

  if (!laeuft) return null;

  const betont = isAccent(beatIndexOfFlash(flash, bpm), beatsPerBar(timeSig));

  return (
    <span
      // Der Schlüssel erzwingt bei jedem Blitz ein frisches Element – so startet die CSS-Animation
      // neu. Ohne das liefe sie nach dem ersten Blitz einfach durch.
      key={flash}
      className={`${styles.punkt}${betont ? ' ' + styles.eins : ''}`}
      aria-hidden="true"
    />
  );
}
