import { ANNO_ZOOM_NS } from '@shared/keys/index';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { StreamOwner } from './streamCompose';
import { drawKeyForOwner, viewKeyForOwner, zoomKeyBaseForOwner } from './streamKeys';

/**
 * Welche Anmerkungs-/Zoom-Ebene gehört zu welcher Seite des durchgehenden Stroms? (#314)
 *
 * Die Schlüssel-GRAMMATIK liegt seit #250 in `streamKeys` und ist gegen `annotationKeys` geprüft.
 * Was hier steht, ist die ENTSCHEIDUNG davor – und die war bis #314 ungetestet, obwohl an ihr hängt,
 * auf welcher Ebene ein gezeichneter Strich landet. Geht sie schief, erscheinen Notizen am falschen
 * Lied, an der falschen Version oder in der falschen Darstellungsart, und es fällt erst im
 * Gottesdienst auf. Genau diese Klasse Fehler waren #199 und #250.
 *
 * Sie lag als Klammer inline in `ChordChart.tsx`; als reine Funktionen ist sie in Sekunden prüfbar.
 */

/** Die angesehene fremde Ebene (Team-Notizen) – so viel davon, wie für die Schlüssel zählt. */
export interface ViewedLevel {
  songId: number;
  lyr: boolean;
  /**
   * Arrangement der angesehenen Ebene (#320, 3c) – `null` bei Bestandsnotizen ohne Segment.
   *
   * SEIN Arrangement, nicht das eigene: Gesucht wird unter dem Schlüssel des Kollegen.
   */
  arrangementId: number | null;
}

/**
 * Gilt für dieses Lied gerade „Nur Text"? – **entschieden am VERÖFFENTLICHTEN Schnappschuss.**
 *
 * `published` sind die Einstellungen, mit denen die aktuell SICHTBAREN Seiten gebaut wurden;
 * `live` sind die, die der Nutzer soeben gewählt hat. Zwischen beiden liegt der asynchrone
 * Neuaufbau des Seitenstroms (er dauert auf einem älteren iPad spürbar lange).
 *
 * Würde hier `live` gewinnen, wechselte die Notiz-Ebene schon beim Umschalten – während auf dem
 * Bildschirm noch die alten Seiten stehen. Ergebnis: Notizen sitzen „vor dem Text", und ein aktiver
 * Stift schreibt in die Ebene, die man gar nicht sieht. Die Ebene muss exakt mit den sichtbaren
 * Seiten wechseln, nicht früher.
 *
 * `live` ist nur der Rückfall, solange noch nichts veröffentlicht ist (erster Aufbau).
 */
export function isLyricsOnlyFor(
  songId: number,
  published: Record<number, SongSettings>,
  live: Record<number, SongSettings>,
): boolean {
  return (published[songId] ?? live[songId] ?? DEFAULT_SETTINGS).lyricsOnly;
}

/** Schlüssel der EIGENEN Anmerkungen dieser Strom-Seite; `null`, solange die Seite keinen Besitzer hat. */
export function drawKeyForPage(
  page: number,
  owners: StreamOwner[],
  published: Record<number, SongSettings>,
  live: Record<number, SongSettings>,
): string | null {
  const o = owners[page];
  return o ? drawKeyForOwner(o, isLyricsOnlyFor(o.songId, published, live)) : null;
}

/**
 * Basis des Zoom-Schlüssels dieser Strom-Seite.
 *
 * Ohne Besitzer (z. B. während des Neuaufbaus) ein eigener, harmloser Schlüssel je Seitenzahl –
 * anders als bei den Anmerkungen gibt es hier kein `null`, weil der Zoom immer irgendwo hin muss.
 * Ein Schlüssel je Seitenzahl kann dabei keine echte Ebene überschreiben.
 */
export function zoomKeyBaseForPage(
  page: number,
  owners: StreamOwner[],
  published: Record<number, SongSettings>,
  live: Record<number, SongSettings>,
): string {
  const o = owners[page];
  if (!o) return `${ANNO_ZOOM_NS}p${page}`;
  return zoomKeyBaseForOwner(o, isLyricsOnlyFor(o.songId, published, live));
}

/**
 * Schlüssel der ANGESEHENEN fremden Ebene („Notizen von …") je Seite – `null`, wenn niemand
 * angesehen wird oder die Seite nicht zum angesehenen Lied gehört.
 *
 * Hier gilt bewusst NICHT der veröffentlichte Schnappschuss, sondern `viewed.lyr`: Es ist die Ebene
 * der anderen Person, die man ansieht. Ihre Versions-Schlüssel kommen aus dem Besitzer der Seite –
 * beim Ansehen gelten für dieses Lied ohnehin ihre Einstellungen (`effSettings`), die Seiten sind
 * also nach ihrer Ansicht gebaut.
 */
export function viewKeyForPage(
  page: number,
  owners: StreamOwner[],
  viewed: ViewedLevel | null,
  viewNamespace: string,
): string | null {
  if (!viewed) return null;
  const o = owners[page];
  if (!o) return null;
  return viewKeyForOwner(
    o,
    {
      songId: viewed.songId,
      versionKey: o.versionKey,
      lyr: viewed.lyr,
      arrangementId: viewed.arrangementId,
    },
    viewNamespace,
  );
}

/**
 * Seiten-Hinweis „Seite x / y" – nur bei mehrseitigen Einheiten (Lied oder Dokument).
 *
 * Gezählt wird über `songIdx`, nicht über `songId`: Steht dasselbe Lied zweimal im Ablauf, sind das
 * zwei Einheiten mit eigener Seitenzählung.
 *
 * `pageIndex` ist der Rückfall, wenn die aktive Seite (die angetippte Hälfte im Querformat) noch
 * keinen Besitzer hat.
 */
export function pageLabelFor(
  activePage: number,
  pageIndex: number,
  owners: StreamOwner[],
): string | null {
  const cur = owners[activePage] ?? owners[pageIndex];
  if (!cur) return null;
  const unitPages = owners.filter((o) => o.songIdx === cur.songIdx).length;
  if (unitPages <= 1) return null;
  return `Seite ${cur.localPage + 1} / ${unitPages}`;
}
