import {
  ANNO_DRAW_NS,
  ANNO_ZOOM_NS,
  docPageKey,
  songPageKey,
  levelPrefix,
} from '@shared/keys/index';
import type { StreamOwner } from './streamCompose';

/**
 * Anmerkungs- und Zoom-Schlüssel einer Seite im durchgehenden Strom (#250).
 *
 * Vorher stand das inline in `pages/ChordChart.tsx` und setzte die Schlüssel von Hand zusammen –
 * inklusive eines dritten Literals für `worship_doczoom_`, obwohl `annotationKeys` sich zur zentralen
 * Grammatik erklärte. Als reine Funktionen sind sie **gegen die Grammatik prüfbar**: Der Test in
 * `annotations.keys.test.ts` lief zuvor gegen handgeschriebene Literale und wäre bei einer Drift
 * (z. B. `_lyrics` statt `_lyr`) grün geblieben – also genau bei dem Fehler, den er festhalten soll.
 */

/** Schlüssel der eigenen Anmerkungen dieser Seite (Striche/Texte). */
export function drawKeyForOwner(owner: StreamOwner, lyricsOnly: boolean): string {
  return (
    ANNO_DRAW_NS +
    (owner.kind === 'doc'
      ? docPageKey(owner.fileId as number, owner.localPage)
      : songPageKey(owner.songId, owner.versionKey, lyricsOnly, owner.localPage))
  );
}

/**
 * Basis des Zoom-Schlüssels dieser Seite. Das Layout-Segment (`_dlarge2`) hängt
 * `useZoomPersistence` an, weil erst dort Geräteklasse und Spaltenzahl bekannt sind.
 */
export function zoomKeyBaseForOwner(owner: StreamOwner, lyricsOnly: boolean): string {
  return (
    ANNO_ZOOM_NS +
    (owner.kind === 'doc'
      ? docPageKey(owner.fileId as number, owner.localPage)
      : songPageKey(owner.songId, owner.versionKey, lyricsOnly, owner.localPage))
  );
}

/**
 * Schlüssel der ANGESEHENEN fremden Ebene (Team-Notizen) – oder `null`, wenn diese Seite nicht dazu
 * gehört. Nur Akkord-Seiten; Dokument-Anmerkungen werden nicht geteilt.
 */
export function viewKeyForOwner(
  owner: StreamOwner,
  viewing: { songId: number; versionKey: string; lyr: boolean } | null,
  viewNamespace: string,
): string | null {
  if (!viewing || owner.kind === 'doc' || owner.songId !== viewing.songId) return null;
  return viewNamespace + songPageKey(owner.songId, owner.versionKey, viewing.lyr, owner.localPage);
}

/** Präfix aller Seiten einer Ebene – für die localStorage-Scans (Stift-Marker, Team-Import). */
export function levelPrefixFor(songId: number, versionKey: string, lyricsOnly: boolean): string {
  return levelPrefix(songId, versionKey, lyricsOnly);
}
