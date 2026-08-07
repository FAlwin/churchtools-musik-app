/**
 * Was hat sich am Ablauf geändert? (#143/#161, ausgelagert mit #198)
 *
 * Zwei Aufgaben, die auf denselben Signaturen aufbauen:
 *  - **Fingerabdruck** einer Setlist – ändert er sich, holt der Client neu (`/setlist/version`).
 *  - **Diff** gegen den zuletzt GESEHENEN Stand – welche Punkte sind neu, geändert, verschoben
 *    oder entfernt (die Markierungen und die „aufgelöst"-Animation im Ablauf).
 *
 * Alles rein und ohne Netzzugriff. Das ist wichtig: Der Fingerabdruck muss auf denselben
 * Roh-Agenda-Daten laufen wie beim „gesehen"-Merken, sonst meldet die App Änderungen, die keine sind.
 */
import { createHash } from 'node:crypto';
import type { CtAgendaItem } from './ctTypes.js';

/**
 * Inhalts-Signatur EINES Ablaufpunkts (#143/#161) – OHNE die id (die ist der Schlüssel). Erfasst
 * Titel, Typ, Lied+Arrangement+Tonart, Verantwortliche, Dauer, Notiz. Änderungen daran = Punkt
 * inhaltlich geändert.
 */
export function agendaItemSignature(i: CtAgendaItem): string {
  const song = i.song ? `${i.song.songId}:${i.song.arrangementId}:${i.song.key ?? ''}` : '';
  const resp = i.responsible?.text ?? '';
  return `${i.title}#${i.type ?? ''}#${song}#${resp}#${i.duration ?? ''}#${i.note ?? ''}`;
}

/**
 * Fingerabdruck einer Setlist (#143): stabile Signatur aus Lied, Arrangement, Tonart UND
 * Reihenfolge der Lied-Punkte. Ändert sich eines davon (Lied neu/raus, umsortiert, Tonart),
 * ändert sich der Fingerabdruck. Nicht-Lieder (Überschriften, Begrüßung …) zählen bewusst nicht.
 * Rein & testbar; muss auf denselben Roh-Agenda-Daten laufen wie beim „gesehen"-Merken.
 */
export function setlistFingerprint(items: CtAgendaItem[]): string {
  // „Struktur + Details" (#143): jede Ablaufänderung schlägt an – Reihenfolge (Array-Position),
  // Punkte hinzu/raus/umbenannt, Lied/Tonart, Verantwortliche, Dauer, Notiz.
  // Als sha256-Digest, NICHT als Klartext: der Wert geht per /setlist/version an jeden Client
  // (inkl. 5-s-Memo über Konten hinweg) – Titel/Notizen/Verantwortliche dürfen darin nicht
  // ablesbar sein. Verglichen wird ohnehin nur auf Gleichheit.
  if (items.length === 0) return '';
  const raw = items.map((i) => `${i.id}#${agendaItemSignature(i)}`).join('|');
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Geordnete Liste je Punkt (id + Inhalts-Signatur + Titel) – Basis für den „gesehen"-Vergleich
 * (#161). Der Titel wird für die „aufgelöst"-Anzeige entfernter Punkte mitgeführt (Etappe B).
 */
export function agendaSignatureList(
  items: CtAgendaItem[],
): { id: number; sig: string; title: string }[] {
  return items.map((i) => ({ id: i.id, sig: agendaItemSignature(i), title: i.title }));
}

/** Längste aufsteigende Teilsequenz (Positionen). Die NICHT enthaltenen Punkte gelten als verschoben. */
function lisPositions(arr: number[]): Set<number> {
  const n = arr.length;
  const keep = new Set<number>();
  if (n === 0) return keep;
  const len = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);
  let best = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[j] < arr[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (len[i] > len[best]) best = i;
  }
  for (let i = best; i !== -1; i = prev[i]) keep.add(i);
  return keep;
}

/**
 * Vergleicht den zuletzt gesehenen Ablauf-Stand (`prev`) mit dem aktuellen (`current`) und liefert,
 * welche Punkte sich verändert haben (#161). Rein & testbar.
 * - `changedIds`: neu, inhaltlich geändert ODER verschoben (relative Reihenfolge über LIS).
 * - `removedIds`: im vorigen Stand vorhanden, jetzt weg (für die „auflösen"-Animation, Etappe B).
 * Ist `prev` leer (nie gesehen), gilt NICHTS als geändert (kein Fehlalarm bei Erstnutzung).
 */
export function diffAgendaItems(
  prev: { id: number; sig: string; title?: string }[],
  current: { id: number; sig: string }[],
): {
  changedIds: number[];
  /** Entfernte Punkte samt Titel und „stand hinter welchem noch vorhandenen Punkt" (afterId,
   *  null = ganz vorne) – der Client blendet sie dort kurz ein und lässt sie auflösen (Etappe B). */
  removed: { id: number; title: string; afterId: number | null }[];
} {
  if (prev.length === 0) return { changedIds: [], removed: [] };
  const prevById = new Map(prev.map((p, index) => [p.id, { sig: p.sig, index }]));
  const changed = new Set<number>();
  for (const it of current) {
    const p = prevById.get(it.id);
    if (!p || p.sig !== it.sig) changed.add(it.id); // neu oder inhaltlich geändert
  }
  // Verschoben: gemeinsame Punkte (unabhängig von Inhaltsänderung) auf Reihenfolge prüfen.
  const common = current.filter((it) => prevById.has(it.id));
  const keep = lisPositions(common.map((it) => prevById.get(it.id)!.index));
  common.forEach((it, k) => {
    if (!keep.has(k)) changed.add(it.id);
  });
  // Entfernt: im vorigen Stand, jetzt weg. Für die Position den letzten noch vorhandenen Vorgänger
  // im vorigen Stand suchen (afterId) – dort blendet der Client den „aufgelöst"-Platzhalter ein.
  const currentIds = new Set(current.map((it) => it.id));
  const removed: { id: number; title: string; afterId: number | null }[] = [];
  prev.forEach((p, i) => {
    if (currentIds.has(p.id)) return;
    let afterId: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (currentIds.has(prev[j].id)) {
        afterId = prev[j].id;
        break;
      }
    }
    removed.push({ id: p.id, title: p.title ?? 'Entfernter Punkt', afterId });
  });
  return { changedIds: [...changed], removed };
}
