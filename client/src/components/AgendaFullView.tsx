/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen – wie in ChurchTools, nur
 * aufgeräumt (#198 – vorher in `pages/Setlist.tsx`). Lieder sind antippbar (→ Charts).
 *
 * Die Uhrzeit (`item.time`) ist bereits serverseitig richtig: In ChurchTools ausgeblendete Punkte
 * (Auge) liefern gar keine Zeit.
 *
 * Der aufwendigste Teil ist das Auflösen entfernter Punkte – Begründung direkt am Code unten.
 */
import { useRef, useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { itemLabel } from '../utils/agendaItemTitle';
import { vanishedRows, type ShownRow } from '../utils/vanishedRows';
import { ItemTitle, ResponsibleLine } from './AgendaRowParts';
import { DisintegratingRow } from './DisintegratingRow';
import styles from '../pages/Setlist.module.scss';

export function AgendaFullView({
  items,
  eventId,
  onSelect,
}: {
  items: AgendaItem[];
  eventId: number;
  onSelect: (songIndex: number) => void;
}) {
  let songIndex = -1;
  // Lokal erzeugte „aufgelöst"-Platzhalter (#178): Punkte, die seit dem Betreten hinzukamen und
  // wieder gelöscht wurden, stehen nicht in der „gesehen"-Basislinie → der Server liefert für sie
  // KEINEN removed-Platzhalter. Die Ansicht merkt sich deshalb selbst, was sie zuletzt gezeigt
  // hat, und lässt auch solche Punkte sichtbar zerfallen statt sie kommentarlos zu entfernen.
  const prevShown = useRef<{ eventId: number; items: AgendaItem[]; rows: ShownRow[] } | null>(null);
  const [localRemoved, setLocalRemoved] = useState<
    { id: number; title: string; afterId: number | null; at: number }[]
  >([]);
  // SYNCHRON während des Renderns abgleichen (NICHT useEffect): sonst rendert erst ein Frame OHNE
  // die gelöschte Zeile (Layout springt), dann fügt der Effekt den Platzhalter wieder ein
  // („blinkt"). Bedingtes setState im Render ist das dokumentierte „State an geänderte Props
  // anpassen"-Muster – gleiche #113-Lektion wie in usePageDraw.
  const prev = prevShown.current;
  if (!prev || prev.eventId !== eventId || prev.items !== items) {
    const shown: ShownRow[] = items
      .filter((i) => !i.removed)
      // Gleiche Bezeichnung wie in der Liste (#215) – sonst stand beim Auflösen plötzlich nur
      // noch der Liedname statt „Lied – Du großer Gott".
      .map((i) => ({ id: i.id, title: itemLabel(i) }));
    prevShown.current = { eventId, items, rows: shown };
    if (!prev || prev.eventId !== eventId) {
      // Terminwechsel/Erstaufbau: nichts auflösen, nur Merkstand setzen.
      if (localRemoved.length) setLocalRemoved([]);
    } else {
      const presentIds = new Set(items.map((i) => i.id));
      const vanished = vanishedRows(prev.rows, presentIds);
      const now = Date.now();
      setLocalRemoved((cur) => {
        // Wieder aufgetauchte IDs (rückgängig gemacht) und alte, längst zerfallene Einträge räumen.
        const kept = cur.filter((c) => !presentIds.has(c.id) && now - c.at < 60_000);
        const fresh = vanished
          .filter((v) => !kept.some((c) => c.id === v.id))
          .map((v) => ({ ...v, at: now }));
        return fresh.length || kept.length !== cur.length ? [...kept, ...fresh] : cur;
      });
    }
  }
  // Lokale Platzhalter an ihrer alten Position einfügen (gleiches Muster wie serverseitig).
  const rendered: (AgendaItem | { id: number; title: string; removed: true })[] = [];
  for (const lr of localRemoved) {
    if (lr.afterId == null) rendered.push({ id: lr.id, title: lr.title, removed: true });
  }
  for (const item of items) {
    rendered.push(item);
    for (const lr of localRemoved) {
      if (lr.afterId === item.id) rendered.push({ id: lr.id, title: lr.title, removed: true });
    }
  }
  return (
    <div className={styles.flowList}>
      {rendered.map((item) => {
        // Entfernter Punkt (#161 Etappe B): kurz sichtbar, dann „poof"-Zerfall.
        if (item.removed) {
          return <DisintegratingRow key={item.id} title={item.title} />;
        }
        const showTime = !!item.time;
        // Geänderter/neuer/verschobener Punkt (#161) leuchtet beim Öffnen kurz auf.
        const chg = item.changed ? ` ${styles.changed}` : '';
        if (item.isHeader) {
          return (
            <div key={item.id} className={`${styles.sectionBand}${chg}`}>
              {showTime && <span className={styles.bandTime}>{item.time}</span>}
              {item.title}
            </div>
          );
        }
        const timeCol = <div className={styles.flowTime}>{showTime ? item.time : ''}</div>;
        const body = (
          <div className={styles.flowBody}>
            <div className={styles.flowHead}>
              <ItemTitle item={item} />
              {item.song && <span className={styles.flowSongTag}>🎵</span>}
              {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
            </div>
            {item.note && <div className={styles.flowNote}>{item.note}</div>}
            <ResponsibleLine entries={item.responsible} />
          </div>
        );
        if (item.song) {
          songIndex += 1;
          const idx = songIndex;
          return (
            <button
              key={item.id}
              className={`${styles.flowRowBtn} ${styles.songRow}${chg}`}
              data-tour={idx === 0 ? 'setlist-song' : undefined}
              onClick={() => onSelect(idx)}
            >
              {timeCol}
              {body}
            </button>
          );
        }
        return (
          <div key={item.id} className={`${styles.flowRow}${chg}`}>
            {timeCol}
            {body}
          </div>
        );
      })}
    </div>
  );
}
