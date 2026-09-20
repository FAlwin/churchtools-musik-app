import type { AbsenceEvent } from '@shared/types/index';

/**
 * Der Kalender-Filter im Tab „Abwesenheiten" (#400) – als reine Funktionen.
 *
 * Alwin: „nur Gottesdienst oder nur Gebetsabend". Entschieden: nach **ChurchTools-Kalender**,
 * **mehrere gleichzeitig**, auf dem Gerät gemerkt. Die Regeln stehen hier und nicht in der
 * Seite, damit sie in Sekunden prüfbar sind – besonders die eine, die man leicht falsch macht:
 *
 * **Eine Auswahl, die auf keinen geladenen Termin passt, gilt als „alle".** Sonst zeigte der Tab
 * eine leere Liste ohne einen einzigen aktiven Knopf, der erklärt, warum – etwa nachdem ein
 * Kalender in ChurchTools gelöscht wurde. Gemessen wird das gegen ALLE geladenen Termine, nicht
 * nur gegen den Monat: Ein Monat ohne Gebetsabend soll bei gewähltem „Gebetsabend" sehr wohl leer
 * sein – das ist die Auskunft, die man wollte.
 */
export interface Kalender {
  id: string;
  name: string;
}

/** Die Kalender aller geladenen Termine – jeder einmal, nach Namen sortiert. */
export function kalenderAus(events: AbsenceEvent[]): Kalender[] {
  const map = new Map<string, string>();
  for (const e of events)
    if (e.kalender && !map.has(e.kalender.id)) map.set(e.kalender.id, e.kalender.name);
  return [...map]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Die wirksame Auswahl: nur IDs, die es unter den geladenen Terminen gibt. Leer heißt „alle" –
 * auch dann, wenn etwas gewählt war, das es nicht mehr gibt (siehe Kopf).
 */
export function wirksameAuswahl(auswahl: string[], events: AbsenceEvent[]): string[] {
  const vorhanden = new Set(kalenderAus(events).map((k) => k.id));
  return auswahl.filter((id) => vorhanden.has(id));
}

/** Termine, die zur Auswahl passen. Ohne wirksame Auswahl alle; ohne Kalender immer dabei. */
export function filtereTermine(events: AbsenceEvent[], auswahl: string[]): AbsenceEvent[] {
  const aktiv = new Set(auswahl);
  if (aktiv.size === 0) return events;
  return events.filter((e) => e.kalender === null || aktiv.has(e.kalender.id));
}

/** Einen Kalender an- oder abwählen. */
export function umschalten(auswahl: string[], id: string): string[] {
  return auswahl.includes(id) ? auswahl.filter((x) => x !== id) : [...auswahl, id];
}
