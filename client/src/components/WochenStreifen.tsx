import { useEffect, useRef, useState } from 'react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import { abwesenheitFuer } from '../utils/absenceDatum';
import { tagImMonat, wocheLabel, wocheTage, wochentagKurz } from '../utils/wochen';
import styles from './WochenStreifen.module.scss';

interface WochenStreifenProps {
  /** Alle Montage, zwischen denen geblättert wird. */
  wochen: string[];
  /** Index der gezeigten Woche in `wochen`. */
  index: number;
  onIndex: (i: number) => void;
  heute: string;
  events: AbsenceEvent[];
  absences: Absence[];
  /** Tipp auf einen Tag (nur heute und später). */
  onTag: (tag: string) => void;
}

/** Ab hier gilt ein Zug als Wischen und nicht als Tippen. */
const SCHWELLE_PX = 8;
/** Anteil der Breite, ab dem beim Loslassen weitergeblättert wird. */
const UMSCHLAG = 0.28;
/** Dauer des Ausgleitens – muss zur Transition in `WochenStreifen.module.scss` passen. */
const GLEIT_MS = 220;

/**
 * Der Wochenstreifen (#177): sieben Kacheln, die am Finger kleben.
 *
 * **Mitziehen statt Umschalten** (Entscheidung Alwin, 05.09.2026, nach drei anfassbaren Entwürfen):
 * Beim Ziehen wandert der Streifen mit, die Nachbarwoche kommt sichtbar herein und rastet beim
 * Loslassen ein; ein halber Zug fällt zurück. Vorher sprang die Woche ohne jede Bewegung um – das
 * fühlte sich an, als hätte man danebengetippt.
 *
 * Umgesetzt mit drei nebeneinanderliegenden Wochen (vorige, aktuelle, nächste) in einer Spur, die
 * verschoben wird. `Pointer`-Ereignisse statt `Touch`, damit es am Rechner mit der Maus genauso geht.
 */
export function WochenStreifen({
  wochen,
  index,
  onIndex,
  heute,
  events,
  absences,
  onTag,
}: WochenStreifenProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const zug = useRef<{ x0: number; breite: number; zieht: boolean; dx: number } | null>(null);
  const [versatz, setVersatz] = useState(0);
  const [animiert, setAnimiert] = useState(false);
  const eventTage = new Set(events.map((e) => e.date));

  // Die drei sichtbaren Wochen: Ränder haben keine Nachbarin – dann bleibt der Platz leer und die
  // Spur kann nicht ins Nichts rutschen.
  const links = index > 0 ? wochen[index - 1] : null;
  const rechts = index < wochen.length - 1 ? wochen[index + 1] : null;

  // Nach dem Wechsel steht die neue Woche in der Mitte – Versatz zurück, ohne Animation.
  useEffect(() => {
    setAnimiert(false);
    setVersatz(0);
  }, [index]);

  const gleitFlug = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(gleitFlug.current ?? undefined), []);

  /**
   * Zur Nachbarwoche **ausgleiten und erst dann wechseln**.
   *
   * Ohne das Ausgleiten sprang die Woche im Moment des Loslassens in die Mitte – der Streifen stand
   * dann sichtbar an einer anderen Stelle als der Finger ihn gelassen hatte (im Browser gemessen,
   * 05.09.2026). Jetzt läuft die Spur die restliche Seitenbreite weiter, und der Wechsel passiert
   * verdeckt am Ende der Bewegung.
   *
   * Ist keine Breite messbar (jsdom im Test, Element noch nicht gelayoutet), gibt es nichts zu
   * animieren – dann wird sofort gewechselt.
   */
  const gleiteZu = (richtung: -1 | 1): void => {
    const ziel = index + richtung;
    const breite = viewport.current?.clientWidth ?? 0;
    if (ziel < 0 || ziel >= wochen.length) {
      setAnimiert(true);
      setVersatz(0);
      return;
    }
    if (breite === 0) {
      onIndex(ziel);
      return;
    }
    setAnimiert(true);
    setVersatz(-richtung * breite);
    window.clearTimeout(gleitFlug.current ?? undefined);
    gleitFlug.current = window.setTimeout(() => onIndex(ziel), GLEIT_MS);
  };

  const loslassen = (): void => {
    const z = zug.current;
    zug.current = null;
    if (!z?.zieht) return;
    const schwelle = z.breite * UMSCHLAG;
    if (z.dx < -schwelle && rechts) gleiteZu(1);
    else if (z.dx > schwelle && links) gleiteZu(-1);
    else {
      setAnimiert(true);
      setVersatz(0);
    }
  };

  return (
    <div className={styles.karte} data-tour="verf-woche">
      <div className={styles.kopf}>
        <button
          className={styles.pfeil}
          onClick={() => gleiteZu(-1)}
          disabled={index === 0}
          aria-label="Vorige Woche"
        >
          ‹
        </button>
        <span className={styles.label}>{wocheLabel(wochen[index])}</span>
        <button
          className={styles.pfeil}
          onClick={() => gleiteZu(1)}
          disabled={index >= wochen.length - 1}
          aria-label="Nächste Woche"
        >
          ›
        </button>
      </div>

      <div
        className={styles.viewport}
        ref={viewport}
        onPointerDown={(e) => {
          zug.current = {
            x0: e.clientX,
            breite: viewport.current?.clientWidth ?? 1,
            zieht: false,
            dx: 0,
          };
        }}
        onPointerMove={(e) => {
          const z = zug.current;
          if (!z) return;
          const dx = e.clientX - z.x0;
          if (!z.zieht && Math.abs(dx) < SCHWELLE_PX) return;
          z.zieht = true;
          // An den Rändern gibt es nichts nachzuziehen – dort nur ein Drittel mitgeben, damit
          // sichtbar wird „hier ist Schluss", ohne dass Leere hereinrutscht.
          const gebremst = (dx < 0 && !rechts) || (dx > 0 && !links) ? dx / 3 : dx;
          // Die Strecke wandert ins Ref, nicht nur in den Zustand: Bei einem sehr schnellen Wisch
          // liegen letzte Bewegung und Loslassen im selben Frame – dann hätte `versatz` im Handler
          // noch den alten Wert und der Wisch verpuffte (im Browser reproduziert, 05.09.2026).
          z.dx = gebremst;
          setAnimiert(false);
          setVersatz(gebremst);
        }}
        onPointerUp={loslassen}
        onPointerCancel={loslassen}
      >
        <div
          className={`${styles.spur}${animiert ? ' ' + styles.gleitet : ''}`}
          /**
           * **Eine Seitenbreite, nicht die ganze Spur.** `translateX(-100%)` verschiebt um die
           * Breite des ELEMENTS – die Spur ist aber drei Seiten breit, der Streifen war damit
           * komplett aus dem Bild (im Browser gesehen, 05.09.2026: leerer Kasten, während alle Tests
           * grün waren). Ein Drittel entspricht genau der mittleren Woche.
           */
          style={{ transform: `translate3d(calc(-33.3333% + ${versatz}px), 0, 0)` }}
        >
          {[links, wochen[index], rechts].map((montag, i) => (
            <div className={styles.seite} key={montag ?? `leer-${i}`} aria-hidden={i !== 1}>
              {montag &&
                wocheTage(montag).map((tag) => {
                  const a = abwesenheitFuer(absences, tag);
                  const vorbei = tag < heute;
                  const cls = [
                    styles.tag,
                    vorbei ? styles.vorbei : '',
                    tag === heute ? styles.heute : '',
                    a?.eigene ? styles.eigen : a ? styles.manuell : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const beschreibung = [
                    `${wochentagKurz(tag)} ${tagImMonat(tag)}.`,
                    eventTage.has(tag) ? 'Termin' : '',
                    a?.eigene ? 'abgemeldet' : a ? 'in ChurchTools eingetragen' : '',
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <button
                      key={tag}
                      className={cls}
                      disabled={vorbei || i !== 1}
                      tabIndex={i === 1 ? 0 : -1}
                      onClick={() => {
                        // Ein Zug, der die Woche verschoben hat, ist kein Tipp.
                        if (!zug.current?.zieht) onTag(tag);
                      }}
                      aria-label={beschreibung}
                    >
                      <small>{wochentagKurz(tag)}</small>
                      <b>{tagImMonat(tag)}</b>
                      <span
                        className={`${styles.punkt}${eventTage.has(tag) ? '' : ' ' + styles.frei}`}
                      />
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.punkte} aria-hidden>
        {wochen.map((w, i) => (
          <i key={w} className={i === index ? styles.an : ''} />
        ))}
      </div>
    </div>
  );
}
