import type { AbsenceEvent, TerminArt } from '@shared/types/index';

/**
 * Der Termin-Filter im Tab „Abwesenheiten" (#400) – als reine Funktionen.
 *
 * Alwin: „nur Gottesdienst oder nur Gebetsabend". Der erste Bau filterte nach ChurchTools-Kalender –
 * bei der ECG liegen beide im selben Kalender, und eine eigene Kategorie kennt ChurchTools an
 * Terminen nicht (gemessen 20.09.2026). Entschieden: **Termin-Arten mit Suchwörtern**, vom Admin
 * gepflegt (`SiteConfig.terminArten`). Ein Termin gehört zur **ersten** Art, deren Suchwort in
 * seinem Namen vorkommt; alle übrigen fallen unter **„Sonstige"**. **Genau EINE Art oder alles**
 * (Alwin, 20.09.2026 spät: „entweder eins oder alles" – die Mehrfachauswahl vom Nachmittag ist
 * wieder raus), auf dem Gerät gemerkt.
 *
 * Die Regel, die man leicht falsch macht: **Eine Auswahl, die auf keinen Knopf passt, gilt als
 * „alle".** Sonst zeigte der Tab eine leere Liste ohne einen aktiven Knopf, der erklärt, warum –
 * etwa nachdem der Admin eine Art gelöscht hat. Gemessen gegen die Knöpfe, die es gerade gibt,
 * nicht gegen den Monat: Ein Monat ohne Gebetsabend soll bei gewähltem „Gebetsabend" sehr wohl
 * leer sein.
 *
 * Die Auswahl bleibt eine Liste (mit höchstens einem Eintrag): So liest die App eine auf dem Gerät
 * gemerkte Mehrfachauswahl aus der Zwischenfassung noch und nimmt ihren ersten Eintrag.
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

/**
 * Die wirksame Auswahl: höchstens EINE ID, zu der es gerade einen Knopf gibt. Leer heißt „alle".
 * Eine gemerkte Liste mit mehreren Einträgen (Zwischenfassung) wird auf ihren ersten gültigen
 * gekürzt statt verworfen.
 */
export function wirksameAuswahl(auswahl: string[], knoepfe: Knopf[]): string[] {
  const vorhanden = new Set(knoepfe.map((k) => k.id));
  return auswahl.filter((id) => vorhanden.has(id)).slice(0, 1);
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
 * Einen Knopf wählen: Er ersetzt die bisherige Wahl. Ein Tipp auf den schon gewählten Knopf hebt
 * die Wahl auf – dann gilt „alle". Entweder eins oder alles (Alwin).
 */
export function umschalten(auswahl: string[], id: string, knoepfe: Knopf[]): string[] {
  const neu = auswahl.includes(id) ? [] : [id];
  return wirksameAuswahl(neu, knoepfe);
}
