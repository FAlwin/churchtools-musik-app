import type { AbsenceEvent, TerminArt } from '@shared/types/index';

/**
 * Der Termin-Filter im Tab „Abwesenheiten" (#400) – als reine Funktionen.
 *
 * Alwin: „nur Gottesdienst oder nur Gebetsabend". Der erste Bau filterte nach ChurchTools-Kalender –
 * bei der ECG liegen beide im selben Kalender, und eine eigene Kategorie kennt ChurchTools an
 * Terminen nicht (gemessen 20.09.2026). Entschieden: **Termin-Arten mit Suchwörtern**, vom Admin
 * gepflegt (`SiteConfig.terminArten`). Ein Termin gehört zur **ersten** Art, deren Suchwort in
 * seinem Namen vorkommt; alle übrigen fallen unter **„Sonstige"**. Mehrere Arten gleichzeitig,
 * auf dem Gerät gemerkt.
 *
 * Zwei Regeln, die man leicht falsch macht:
 *  - **Eine Auswahl, die auf keinen Knopf passt, gilt als „alle".** Sonst zeigte der Tab eine
 *    leere Liste ohne einen aktiven Knopf, der erklärt, warum – etwa nachdem der Admin eine Art
 *    gelöscht hat. Gemessen gegen die Knöpfe, die es gerade gibt, nicht gegen den Monat: Ein Monat
 *    ohne Gebetsabend soll bei gewähltem „Gebetsabend" sehr wohl leer sein.
 *  - **Sind alle Knöpfe gewählt, ist das „alle"** (Wunsch Alwin) – die Auswahl wird geleert, statt
 *    dass jeder Knopf einzeln blau bleibt und „Alle" grau.
 */
export const SONSTIGE_ID = 'sonstige';

export interface Knopf {
  id: string;
  name: string;
}

/** Zu welcher Art ein Termin gehört – die ID der ersten passenden Art, sonst „Sonstige". */
export function artVon(event: AbsenceEvent, arten: TerminArt[]): string {
  const name = event.name.toLocaleLowerCase('de');
  const treffer = arten.find((a) => {
    const w = a.suchwort.trim().toLocaleLowerCase('de');
    return w !== '' && name.includes(w);
  });
  return treffer?.id ?? SONSTIGE_ID;
}

/**
 * Die Knöpfe: die Arten in der Reihenfolge des Admins, aber nur die, zu denen es Termine gibt –
 * plus „Sonstige", wenn ein Termin nirgends hineinpasst. Ein Knopf ohne Termine wäre eine Frage
 * ohne Antwort.
 */
export function knoepfeAus(arten: TerminArt[], events: AbsenceEvent[]): Knopf[] {
  const belegt = new Set(events.map((e) => artVon(e, arten)));
  const knoepfe: Knopf[] = arten
    .filter((a) => belegt.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));
  if (belegt.has(SONSTIGE_ID)) knoepfe.push({ id: SONSTIGE_ID, name: 'Sonstige' });
  return knoepfe;
}

/** Die wirksame Auswahl: nur IDs, zu denen es gerade einen Knopf gibt. Leer heißt „alle". */
export function wirksameAuswahl(auswahl: string[], knoepfe: Knopf[]): string[] {
  const vorhanden = new Set(knoepfe.map((k) => k.id));
  const gueltig = auswahl.filter((id) => vorhanden.has(id));
  // Alles gewählt = nichts gefiltert.
  return gueltig.length >= knoepfe.length ? [] : gueltig;
}

/** Termine, die zur Auswahl passen. Ohne wirksame Auswahl alle. */
export function filtereTermine(
  events: AbsenceEvent[],
  auswahl: string[],
  arten: TerminArt[],
): AbsenceEvent[] {
  const aktiv = new Set(auswahl);
  if (aktiv.size === 0) return events;
  return events.filter((e) => aktiv.has(artVon(e, arten)));
}

/**
 * Einen Knopf an- oder abwählen. Sind danach **alle** Knöpfe gewählt, springt die Auswahl auf
 * „alle" (leer) – Alwins Wunsch: „wenn ich alle anklicke, kann es auch automatisch auf alle
 * springen".
 */
export function umschalten(auswahl: string[], id: string, knoepfe: Knopf[]): string[] {
  const neu = auswahl.includes(id) ? auswahl.filter((x) => x !== id) : [...auswahl, id];
  return wirksameAuswahl(neu, knoepfe);
}
