/**
 * Stabile Identitäten für die Anmerkungs-Schlüssel der Seiten-Engine (#193).
 *
 * **Das Problem, das hier gelöst wird.** `drawKeyFor`/`zoomKeyBaseFor` kommen als Props in
 * `PageDeck` herein und sind **je Render neue Funktionen** (ChordChart erzeugt sie inline, sie
 * hängen an `owners` + Anzeige-Einstellungen). Als Effekt-Abhängigkeit hätten sie jeden teuren
 * Neuaufbau bei JEDEM Render ausgelöst – deshalb standen in PageDeck 11× `exhaustive-deps` aus,
 * und der Abhängigkeitsgraph der riskantesten Datei der App war maschinell nicht mehr prüfbar.
 *
 * **Der Ausweg:** Nicht die Funktion ist die Abhängigkeit, sondern ihr *Ergebnis*. Die Schlüssel
 * der sichtbaren Seiten werden zu einer Zeichenkette verschmolzen; ein `useMemo` darüber liefert
 * ein Array mit **stabiler Identität**, solange sich die Schlüssel nicht ändern. Damit lassen sich
 * alle Abhängigkeiten ehrlich aufführen.
 *
 * Nebenbei schließt das eine stille Lücke: Bisher lief das Neuzeichnen nur bei Seiten-, Layout-
 * oder Sync-Wechsel. Änderte sich ein Schlüssel aus anderem Grund (z. B. „Nur Text" umgeschaltet →
 * anderer `_lyr`-Namensraum), blieb der alte Strich-Stand stehen. Jetzt ist genau dieser Wechsel
 * die Abhängigkeit.
 */

/** Trenner zwischen zwei Schlüsseln – kommt in localStorage-Schlüsseln nicht vor. */
const SEP = '\u0001';
/** Platzhalter für „kein Schlüssel" (null) – unterscheidbar von einem echten Schlüssel. */
const NONE = '\u0000';

/** Verschmilzt Schlüssel zu einer Zeichenkette, die sich genau dann ändert wie die Schlüssel. */
export function joinKeys(keys: readonly (string | null)[]): string {
  return keys.map((k) => k ?? NONE).join(SEP);
}

/**
 * Kehrt `joinKeys` um. Gedacht für `useMemo(() => splitKeys(sig), [sig])` – so hängt das
 * zurückgegebene Array nachweislich nur an der Signatur.
 *
 * Hinweis: Leere Schlüssel (`''`) sind nicht vorgesehen – Anmerkungs-Schlüssel sind immer
 * entweder ein echter Name oder `null`.
 */
export function splitKeys(sig: string): (string | null)[] {
  if (sig === '') return [];
  return sig.split(SEP).map((s) => (s === NONE ? null : s));
}
