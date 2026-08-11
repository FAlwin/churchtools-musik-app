/**
 * Zentrale Grammatik der Anmerkungs-Schlüssel im localStorage.
 *
 * Ein Ebenen-/Seiten-Schlüssel hat die Form `song<id>_v<versionKey>(_lyr)?_<seite>`, ggf. mit
 * `_text`-Suffix (Textobjekte) und einem Namensraum-Präfix davor: `worship_docdraw_` (eigene
 * Anmerkungen) oder dem Team-Ansichts-Spiegel (`VIEW_NS`). Diese Grammatik ist zusätzlich in
 * `services/annotations.ts` (`KEY_RE`) und serverseitig (Zod) kodiert – hier gebündelt, damit die
 * localStorage-Scans (Stift-Marker im Lied-Menü, Team-Import) nicht jeweils eigene Regexe pflegen.
 */

import { ANNO_DRAW_NS, levelPrefix } from '@shared/keys/index';

/** Präfix der EIGENEN (privaten) Anmerkungen – aus der geteilten Grammatik (#250). */
export const OWN_DRAW_PREFIX = ANNO_DRAW_NS;

/**
 * Basis-Schlüssel einer Ebenen-Seite (ohne Namensraum-Präfix, ohne `_text`).
 *
 * Das Arrangement-Segment (#320) ist erlaubt, wird aber NICHT ausgewertet: Diese Auflistung
 * beantwortet „auf welchen Ebenen hat jemand Notizen", und eine Ebene ist hier Version +
 * Darstellungsart. Wichtig ist, dass arrangement-genaue Schlüssel überhaupt **gesehen** werden –
 * ohne das Segment im Muster fielen sie stillschweigend heraus und die Notizen eines Kollegen
 * wären in der Auswahl unsichtbar.
 *
 * Dass zwei Arrangements dabei zu einer Ebene verschmelzen, ist die offene Frage von Schritt 3.
 * Solange die Migration nur KOPIERT, sind es dieselben Seiten, und die Vereinigung ändert nichts.
 *
 * Das Arrangement wird jetzt AUSGEWERTET (#320, Schritt 3c): Zwei Arrangements können je eine
 * Version „Akustik" haben – gleicher Versions-Schlüssel, anderes Notenblatt. Verschmolzen sie hier
 * zu einer Ebene, fände man die Striche eines Kollegen nicht, sobald er ein anderes Arrangement
 * gewählt hat: Der Schlüssel, unter dem gesucht wird, gäbe es bei ihm nicht.
 *
 * Damit ist es das DRITTE Muster über dieselbe Grammatik (nach `ANNO_KEY_RE` und dem Muster in
 * `arrangementMigration`). Beim Erweitern des Schlüssels sind alle drei zu prüfen.
 */
const LEVEL_PAGE_RE = /^song\d+(?:_a(\d+))?_v([a-z0-9-]+)(_lyr)?_(\d+)$/i;

/** Präfix aller Seiten EINER Ebene (Version + Darstellungsart) eines Lieds – ohne Namensraum. */
export function levelPagePrefix(songId: number, versionKey: string, lyr: boolean): string {
  return levelPrefix(songId, versionKey, lyr);
}

/** Hat das Konto eigene, nicht-leere Anmerkungen (Striche ODER Texte) auf dieser Ebene? */
export function hasStoredNotesForLevel(songId: number, versionKey: string, lyr: boolean): boolean {
  const prefix = OWN_DRAW_PREFIX + levelPagePrefix(songId, versionKey, lyr);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    // Nur reine Seiten-Schlüssel (Striche) bzw. deren `_text` zählen – keine Fremd-/Zoom-Suffixe.
    const rest = k.slice(prefix.length);
    if (!/^\d+(_text)?$/.test(rest)) continue;
    const v = localStorage.getItem(k);
    if (v && v !== '[]') return true;
  }
  return false;
}

/** Eine Anmerkungs-Ebene mit den Seiten, auf denen etwas gespeichert ist. */
interface AnnotationLevel {
  versionKey: string;
  lyr: boolean;
  /** Arrangement der Ebene, `null` bei Bestandsnotizen ohne Segment. */
  arrangementId: number | null;
  pages: number[];
}

/**
 * Stabiler Gruppen-Schlüssel einer Ebene (Arrangement + Version + Darstellungsart).
 *
 * Das Arrangement gehört dazu, weil zwei Arrangements dieselben Versionsnamen haben können. Ohne es
 * lägen die Seiten zweier verschiedener Notenblätter in einer Gruppe.
 */
export const levelKeyOf = (g: {
  versionKey: string;
  lyr: boolean;
  arrangementId: number | null;
}): string => `${g.arrangementId ?? ''}|${g.versionKey}|${g.lyr ? '1' : '0'}`;

/**
 * Alle Ebenen (Version + Darstellungsart) mit ihren Seiten unter einem Namensraum-Präfix
 * (z. B. dem Team-Ansichts-Spiegel `VIEW_NS`), Seiten aufsteigend sortiert.
 */
export function levelsUnderNamespace(nsPrefix: string): AnnotationLevel[] {
  const map = new Map<string, Set<number>>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(nsPrefix)) continue;
    const base = k.slice(nsPrefix.length).replace(/_text$/, '');
    const m = LEVEL_PAGE_RE.exec(base);
    if (!m) continue;
    const gk = levelKeyOf({
      arrangementId: m[1] ? Number(m[1]) : null,
      versionKey: m[2],
      lyr: !!m[3],
    });
    if (!map.has(gk)) map.set(gk, new Set());
    map.get(gk)!.add(Number(m[4]));
  }
  return [...map.entries()].map(([gk, pages]) => {
    const [arr, versionKey, lyr] = gk.split('|');
    return {
      arrangementId: arr === '' ? null : Number(arr),
      versionKey,
      lyr: lyr === '1',
      pages: [...pages].sort((a, b) => a - b),
    };
  });
}

/**
 * Die Textobjekte EINER Anmerkungs-Seite aus dem lokalen Speicher (#198).
 *
 * Warum hier: Das `_text`-Suffix gehört zur Schlüssel-Grammatik dieses Moduls. Vorher hängten es
 * die Komponenten selbst an – die Grammatik war damit an mehreren Stellen verstreut, obwohl der
 * Rest davon (Präfixe, Ebenen, Seitenzahl) längst hier liegt.
 *
 * Kaputtes JSON ergibt eine leere Liste: Eine unlesbare Anmerkung darf die Seite nicht mitreißen.
 */
export function readPageTexts<T>(pageKey: string | null): T[] {
  if (!pageKey) return [];
  try {
    const raw = localStorage.getItem(`${pageKey}_text`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
