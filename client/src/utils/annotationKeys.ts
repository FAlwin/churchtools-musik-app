/**
 * Zentrale Grammatik der Anmerkungs-Schlüssel im localStorage.
 *
 * Ein Ebenen-/Seiten-Schlüssel hat die Form `song<id>_v<versionKey>(_lyr)?_<seite>`, ggf. mit
 * `_text`-Suffix (Textobjekte) und einem Namensraum-Präfix davor: `worship_docdraw_` (eigene
 * Anmerkungen) oder dem Team-Ansichts-Spiegel (`VIEW_NS`). Diese Grammatik ist zusätzlich in
 * `services/annotations.ts` (`KEY_RE`) und serverseitig (Zod) kodiert – hier gebündelt, damit die
 * localStorage-Scans (Stift-Marker im Lied-Menü, Team-Import) nicht jeweils eigene Regexe pflegen.
 */

/** Präfix der EIGENEN (privaten) Anmerkungen im localStorage. */
export const OWN_DRAW_PREFIX = 'worship_docdraw_';

/** Basis-Schlüssel einer Ebenen-Seite (ohne Namensraum-Präfix, ohne `_text`). */
const LEVEL_PAGE_RE = /^song\d+_v([a-z0-9-]+)(_lyr)?_(\d+)$/i;

/** Präfix aller Seiten EINER Ebene (Version + Darstellungsart) eines Lieds – ohne Namensraum. */
export function levelPagePrefix(songId: number, versionKey: string, lyr: boolean): string {
  return `song${songId}_v${versionKey}${lyr ? '_lyr' : ''}_`;
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
export interface AnnotationLevel {
  versionKey: string;
  lyr: boolean;
  pages: number[];
}

/** Stabiler Gruppen-Schlüssel einer Ebene (Version + Darstellungsart). */
export const levelKeyOf = (g: { versionKey: string; lyr: boolean }): string =>
  `${g.versionKey}|${g.lyr ? '1' : '0'}`;

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
    const gk = levelKeyOf({ versionKey: m[1], lyr: !!m[2] });
    if (!map.has(gk)) map.set(gk, new Set());
    map.get(gk)!.add(Number(m[3]));
  }
  return [...map.entries()].map(([gk, pages]) => {
    const [versionKey, lyr] = gk.split('|');
    return { versionKey, lyr: lyr === '1', pages: [...pages].sort((a, b) => a - b) };
  });
}
