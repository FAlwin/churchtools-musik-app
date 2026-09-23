/**
 * **Wächter: Zod-Schema und geteilter Typ haben dieselben Felder – auch die optionalen.**
 *
 * Zod entfernt beim Parsen stillschweigend jedes Feld, das im Schema fehlt. Fehlt dort also ein Feld,
 * das Client und Typ kennen, geht es auf dem Weg zum Speicher verloren, ohne Fehler und ohne Warnung.
 * Das hat dieses Projekt dreimal getroffen: #115 (`bold` bei den Anmerkungen), bei den Arrangements
 * (v2.25.1) und bei den Uhrzeiten der Abwesenheiten (22.09.2026).
 *
 * Der ältere Wächter – zwei Zuweisungen in beide Richtungen – **kann das bei optionalen Feldern gar
 * nicht bemerken**: Ein Typ mit einem zusätzlichen `feld?: x` bleibt in beide Richtungen zuweisbar.
 * Nachgestellt am 23.09.2026: `bold` aus dem Anmerkungs-Schema entfernt, der Build blieb grün –
 * obwohl der Kommentar dort das Gegenteil versprach und genau #115 der Anlass für ihn war.
 *
 * `Required<…>` macht alle Felder verbindlich, dann lassen sich die Schlüsselmengen vergleichen.
 * Benutzung – der Übersetzer bricht ab und nennt das abweichende Feld:
 *
 * ```ts
 * const _w: GleicheSchluessel<MeinTyp, z.infer<typeof meinSchema>> = true;
 * void _w;
 * ```
 *
 * Geprüft wird nur die **Schlüsselmenge** einer Ebene. Verschachtelte Objekte (etwa die Texte in einer
 * Anmerkung) brauchen je eine eigene Zeile.
 */
type Differenz<A, B> =
  | Exclude<keyof Required<A>, keyof Required<B>>
  | Exclude<keyof Required<B>, keyof Required<A>>;

export type GleicheSchluessel<A, B> = [Differenz<A, B>] extends [never]
  ? true
  : { nichtDeckungsgleich: Differenz<A, B> };
