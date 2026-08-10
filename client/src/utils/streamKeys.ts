import { ANNO_DRAW_NS, ANNO_ZOOM_NS, docPageKey, songPageKey } from '@shared/keys/index';
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
      : songPageKey(
          owner.songId,
          owner.versionKey,
          lyricsOnly,
          owner.localPage,
          owner.arrangementId,
        ))
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
      : songPageKey(
          owner.songId,
          owner.versionKey,
          lyricsOnly,
          owner.localPage,
          owner.arrangementId,
        ))
  );
}

/**
 * Schlüssel der ANGESEHENEN fremden Ebene (Team-Notizen) – oder `null`, wenn diese Seite nicht dazu
 * gehört. Nur Akkord-Seiten; Dokument-Anmerkungen werden nicht geteilt.
 *
 * **Bewusst OHNE Arrangement-Segment (#320, offen für Schritt 3):** Hier wird der Schlüssel einer
 * FREMDEN Ebene zusammengebaut. Welches Arrangement die andere Person benutzt hat, weiß diese
 * Funktion nicht – `viewing` trägt es nicht. Das eigene einzusetzen wäre schlimmer als keines: Man
 * suchte dann unter einem Schlüssel, den es bei ihr gar nicht gibt, und sähe ihre Striche nie.
 * Ohne Segment findet man weiterhin ihren Bestand; erst wenn sie arrangement-genau zeichnet, fehlt
 * etwas. Die saubere Lösung braucht das Arrangement in `viewing` – das ist Schritt 3.
 */
export function viewKeyForOwner(
  owner: StreamOwner,
  viewing: { songId: number; versionKey: string; lyr: boolean } | null,
  viewNamespace: string,
): string | null {
  if (!viewing || owner.kind === 'doc' || owner.songId !== viewing.songId) return null;
  return viewNamespace + songPageKey(owner.songId, owner.versionKey, viewing.lyr, owner.localPage);
}
