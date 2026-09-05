import { useRef } from 'react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import { abwesenheitFuer } from '../utils/absenceDatum';
import { tagImMonat, wocheLabel, wocheTage, wochentagKurz } from '../utils/wochen';
import styles from './WochenStreifen.module.scss';

export interface Auswahl {
  von: string;
  bis?: string;
}

interface WochenStreifenProps {
  /** Alle Montage, zwischen denen geblättert wird. */
  wochen: string[];
  /** Index der gezeigten Woche in `wochen`. */
  index: number;
  onIndex: (i: number) => void;
  heute: string;
  events: AbsenceEvent[];
  absences: Absence[];
  auswahl: Auswahl | null;
  /** Tipp auf einen Tag (nur heute und später). */
  onTag: (tag: string) => void;
}

/**
 * Der Wochenstreifen (#177, Variante C): sieben Kacheln, wischbar und mit Pfeilen. Jede Kachel
 * sagt in Form und Farbe, was der Tag ist – Punkt = Termin, rot = selbst abgemeldet, grau = in
 * ChurchTools eingetragen, blau = gerade gewählt. Vergangene Tage sind nur noch Kontext.
 */
export function WochenStreifen({
  wochen,
  index,
  onIndex,
  heute,
  events,
  absences,
  auswahl,
  onTag,
}: WochenStreifenProps) {
  const montag = wochen[index];
  const tage = wocheTage(montag);
  const startX = useRef<number | null>(null);
  const eventTage = new Set(events.map((e) => e.date));

  const blaettern = (richtung: -1 | 1): void => {
    const ziel = index + richtung;
    if (ziel >= 0 && ziel < wochen.length) onIndex(ziel);
  };

  const gewaehlt = (tag: string): 'start' | 'ende' | 'innen' | null => {
    if (!auswahl) return null;
    const bis = auswahl.bis ?? auswahl.von;
    if (tag === auswahl.von && tag === bis) return 'start';
    if (tag === auswahl.von) return 'start';
    if (tag === bis) return 'ende';
    return auswahl.von < tag && tag < bis ? 'innen' : null;
  };

  return (
    <div
      className={styles.karte}
      data-tour="verf-woche"
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = startX.current;
        const x1 = e.changedTouches[0]?.clientX;
        startX.current = null;
        if (x0 == null || x1 == null) return;
        const dx = x1 - x0;
        if (dx > 40) blaettern(-1);
        else if (dx < -40) blaettern(1);
      }}
    >
      <div className={styles.kopf}>
        <button
          className={styles.pfeil}
          onClick={() => blaettern(-1)}
          disabled={index === 0}
          aria-label="Vorige Woche"
        >
          ‹
        </button>
        <span className={styles.label}>{wocheLabel(montag)}</span>
        <button
          className={styles.pfeil}
          onClick={() => blaettern(1)}
          disabled={index >= wochen.length - 1}
          aria-label="Nächste Woche"
        >
          ›
        </button>
      </div>
      <div className={styles.streifen} role="group" aria-label={`Woche ${wocheLabel(montag)}`}>
        {tage.map((tag) => {
          const a = abwesenheitFuer(absences, tag);
          const vorbei = tag < heute;
          const wahl = gewaehlt(tag);
          const cls = [
            styles.tag,
            vorbei ? styles.vorbei : '',
            tag === heute ? styles.heute : '',
            a?.eigene ? styles.eigen : a ? styles.manuell : '',
            wahl ? styles.wahl : '',
            wahl === 'start' || wahl === 'ende' ? styles.rand : '',
          ]
            .filter(Boolean)
            .join(' ');
          const beschreibung = [
            `${wochentagKurz(tag)} ${tagImMonat(tag)}.`,
            eventTage.has(tag) ? 'Termin' : '',
            a?.eigene ? 'abgemeldet' : a ? 'in ChurchTools eingetragen' : '',
            wahl ? 'gewählt' : '',
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <button
              key={tag}
              className={cls}
              disabled={vorbei}
              onClick={() => onTag(tag)}
              aria-label={beschreibung}
              aria-pressed={wahl !== null}
            >
              <small>{wochentagKurz(tag)}</small>
              <b>{tagImMonat(tag)}</b>
              <span className={`${styles.punkt}${eventTage.has(tag) ? '' : ' ' + styles.frei}`} />
            </button>
          );
        })}
      </div>
      <div className={styles.punkte} aria-hidden>
        {wochen.map((w, i) => (
          <i key={w} className={i === index ? styles.an : ''} />
        ))}
      </div>
    </div>
  );
}
