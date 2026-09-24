import { config } from '../config.js';

/**
 * **Ein Zeitpunkt als `YYYY-MM-DD` – die eine Stelle im Server.**
 *
 * Gerechnet wird in **UTC**, und das ist hier richtig: Die Werte gehen als Zeitfenster (`from`/`to`)
 * an ChurchTools, der Server läuft im Container ohne gesetzte Zeitzone, und ein Fenster von einer
 * Woche bis sechs Wochen verträgt eine Stunde Verschiebung. Der **Client** hat dafür eine eigene
 * Stelle (`utils/heute.ts`), die absichtlich LOKAL rechnet: Dort geht es um die Frage, welcher Tag
 * für den Nutzer „heute" ist, und die beantwortet UTC zwischen Mitternacht und 2 Uhr falsch.
 *
 * Bis zum 21.09.2026 stand diese eine Zeile im Server an drei Stellen (`absences`,
 * `setlistController`, `setlistBuilder`) – zusammengeführt im Code-Check.
 */
export function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hat der Zeitpunkt eine Zeitzonen-Angabe (`Z` oder `+02:00`)? Nur dann lässt er sich umrechnen. */
const MIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Ein Formatierer je Zeitzone – `Intl.DateTimeFormat` anzulegen ist teuer, Termine gibt es viele. */
const formatierer = new Map<string, Intl.DateTimeFormat>();

function tagFormat(zeitzone: string): Intl.DateTimeFormat {
  let f = formatierer.get(zeitzone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zeitzone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatierer.set(zeitzone, f);
  }
  return f;
}

/**
 * **Der Tag eines ChurchTools-Zeitpunkts – in der Zeitzone der Gemeinde** (#414). Die eine Stelle
 * (#410); bis zum 23.09.2026 stand sie als `startDate.slice(0, 10)` dreimal im Server (Termine,
 * Ablauf-Aufbau, Abwesenheiten).
 *
 * Bis zum 24.09.2026 war das der Tag, **wie er im Text steht** – bei ChurchTools also der
 * **UTC-Tag** (die Termine kommen als `…Z`). Ein Termin um 0:30 Uhr deutscher Zeit (`22:30Z` des
 * Vortags) landete damit auf dem Vortag: in der Terminliste, im Ablauf und bei den Abwesenheiten.
 * Jetzt zählt der Tag, an dem er **in der Gemeinde** stattfindet (`config.zeitzone`).
 *
 * Ohne Zeitzonen-Angabe (`2026-10-04` oder `2026-10-04T08:00:00`) steht der gemeinte Tag schon im
 * Text – umgerechnet würde er nach der Zeitzone des Servers, und die ist im Container UTC.
 *
 * ⚠️ Die Abwesenheiten schreiben diesen Tag als `startDate` nach ChurchTools, und `absenceBody`
 * prüft, dass die Uhrzeit dazu passt. Beide hängen an DIESER Funktion – deshalb stimmen Haken und
 * Eintrag auch nach der Umstellung überein.
 */
export function tagAusIso(zeitpunkt: string, zeitzone: string = config.zeitzone): string {
  if (!MIT_ZONE.test(zeitpunkt)) return zeitpunkt.slice(0, 10);
  const ms = Date.parse(zeitpunkt);
  if (Number.isNaN(ms)) return zeitpunkt.slice(0, 10);
  const teile = tagFormat(zeitzone).formatToParts(ms);
  const teil = (typ: Intl.DateTimeFormatPartTypes): string =>
    teile.find((t) => t.type === typ)?.value ?? '';
  return `${teil('year')}-${teil('month')}-${teil('day')}`;
}
