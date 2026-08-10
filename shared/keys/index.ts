/**
 * Die Grammatik der Anmerkungs- und Einstellungs-Schlüssel – **einzige Quelle für Client UND
 * Server** (#250).
 *
 * Warum hier und nicht je Seite: Die Schlüssel wurden an fünf Stellen von Hand zusammengesetzt, und
 * die prüfenden Regexe standen zweimal wortgleich über die Prozessgrenze (Client `services/` vs.
 * Server-Controller). Genau diese Art Dopplung hat dieses Projekt mehrfach getroffen – zuletzt hat
 * ein abweichendes Segment den Querformat-Zoom still nicht mehr synchronisiert. Wer eine Regel hier
 * ändert, ändert sie überall.
 *
 * **Aufbau eines Anmerkungs-Schlüssels** (localStorage):
 * ```
 * worship_docdraw_ song12_voriginal_lyr_3 _text
 * └── Namensraum ─┘ └──── Ebene+Seite ──┘ └ optional (Textobjekte)
 * ```
 * Der **Server** kennt nur den mittleren Teil (`song12_voriginal_lyr_3`); die Namensräume und das
 * `_text`-Suffix sind reine Client-Sache.
 *
 * Beim **Zoom** kommt hinten ein Layout-Segment dazu (`_dlarge2` = große Geräteklasse, 2 Spalten
 * sichtbar), weil derselbe Ausschnitt im Hoch- und Querformat unterschiedlich liegt.
 */

// ── Namensräume (nur Client/localStorage) ────────────────────────────────────
/** Eigene (private) Anmerkungen. */
export const ANNO_DRAW_NS = 'worship_docdraw_';
/** Zoom-Ausschnitte. */
export const ANNO_ZOOM_NS = 'worship_doczoom_';

// ── Ebene + Seite (das, was auch der Server sieht) ───────────────────────────
/**
 * Ebenen-Präfix eines Lieds: alle Seiten EINER Version + Darstellungsart – und seit #320 auch EINES
 * Arrangements.
 *
 * **Warum das Arrangement dazugehört:** Die ChordPro-Versionen liegen als Dateien IM Arrangement.
 * Zwei Arrangements können also je eine Version „Akustik" haben – gleicher Versions-Schlüssel,
 * anderes Notenblatt. Ohne das Segment lägen die Striche aus der Band-Fassung auf den Seiten der
 * Akustik-Fassung, sobald man umschaltet.
 *
 * **`arrangementId` ist optional, und das ist Absicht:** Ohne Angabe entsteht der ALTE Schlüssel.
 * So bleibt jeder Bestand gültig, und der Aufrufer entscheidet, ob er schon arrangement-genau
 * arbeitet. Das Segment steht direkt hinter dem Lied (`song12_a45_voriginal_…`) und nicht am Ende –
 * hinten hängt beim Zoom bereits das Layout-Segment (`_dlarge2`), zwei wandernde Enden wären eine
 * Fehlerquelle mehr.
 *
 * `_lyr` ist die eigene Notiz-Ebene der Darstellung „Nur Text"; ohne Segment = „Akkorde & Text"
 * (so bleiben Bestandsnotizen von vor dieser Unterscheidung gültig).
 */
export function levelPrefix(
  songId: number,
  versionKey: string,
  lyricsOnly: boolean,
  arrangementId?: number | null,
): string {
  const arr = arrangementId != null ? `_a${arrangementId}` : '';
  return `song${songId}${arr}_v${versionKey}${lyricsOnly ? '_lyr' : ''}_`;
}

/** Schlüssel einer konkreten Lied-Seite (ohne Namensraum). */
export function songPageKey(
  songId: number,
  versionKey: string,
  lyricsOnly: boolean,
  page: number,
  arrangementId?: number | null,
): string {
  return `${levelPrefix(songId, versionKey, lyricsOnly, arrangementId)}${page}`;
}

/**
 * Schlüssel einer Seite eines hochgeladenen Dokuments (ohne Namensraum).
 * Hängt an der ChurchTools-Datei-ID, nicht an Lied + Version – deshalb bleibt er **lokal** und wird
 * nie zum Konto synchronisiert (er passt absichtlich nicht auf {@link ANNO_KEY_RE}).
 */
export function docPageKey(fileId: number, page: number): string {
  return `${fileId}_${page}`;
}

/** Layout-Segment des Zoom-Schlüssels: gleiche Seite, anderes Layout = anderer Ausschnitt. */
export function zoomLayoutSuffix(deviceClass: 'phone' | 'large', perView: number): string {
  return `_d${deviceClass}${perView}`;
}

// ── Prüfmuster ───────────────────────────────────────────────────────────────
/**
 * Gültige Anmerkungs-Schlüssel **auf dem Server** (Konto-Sync).
 *
 * Das abschließende Layout-Segment MUSS erlaubt sein, sonst wird der Querformat-Zoom nie
 * synchronisiert. Dokument-Schlüssel passen absichtlich nicht – sie bleiben lokal.
 */
export const ANNO_KEY_RE = /^song\d+(?:_a\d+)?_v[a-z0-9-]+(?:_lyr)?_\d+(?:_d(?:phone|large)\d?)?$/i;

/**
 * Die Namen aller Einstellungen, die zum Konto synchronisiert werden – **die einzige Liste**.
 *
 * Sie stand zweimal: hier im Prüfmuster und ein zweites Mal inline in `songIdOf` des Servers, direkt
 * unter dem Kommentar „liegt in @shared/keys … hier nur re-exportiert". Genau daran ist es dann
 * aufgefallen: Beim Hinzufügen der Zählweise (`zaehl`, #145) wurde **keine** der beiden Listen
 * erweitert – die Einstellung blieb still auf einem Gerät liegen, während Tonart und Spalten
 * mitwandern. Wer hier etwas ergänzt, ergänzt es überall.
 *
 * Eine Einstellung, die NICHT hier steht, funktioniert lokal weiter und wird nur nicht
 * synchronisiert. Das ist der gefährliche Fall: Es fällt niemandem auf, bis jemand das Gerät
 * wechselt.
 */
export const SETTINGS_BASES = [
  'key',
  'capo',
  'cols',
  'fs',
  'lyrics',
  'secshift',
  'ver',
  'view',
  'zaehl',
] as const;

/**
 * Gültige Einstellungs-Schlüssel (Konto-Sync).
 *
 * Bewusst **nicht** `…_\d+$`: Das hätte die versionsbezogenen Schlüssel
 * (`worship_key_12_akustik`) still verworfen und Einstellungen geräteübergreifend gelöscht (#215).
 * Der End-Anker ist trotzdem nötig, sonst kommt `worship_key_1<Müll>` durch.
 */
export const SETTINGS_KEY_RE = new RegExp(
  `^worship_(?:${SETTINGS_BASES.join('|')})_\\d+(?:_[a-z0-9-]+){0,2}$`,
);

/** Nur der Anfang eines Einstellungs-Schlüssels bis zur Lied-ID – für `songIdOf` auf dem Server. */
export const SETTINGS_SONGID_RE = new RegExp(`^worship_(?:${SETTINGS_BASES.join('|')})_(\\d+)`);

/** Alte (versionslose) Schlüssel auf das aktuelle Schema heben: `song12_3` → `song12_voriginal_3`. */
export function normalizeAnnoKey(key: string): string {
  if (ANNO_KEY_RE.test(key)) return key;
  const m = key.match(/^song(\d+)_(\d+)$/);
  return m ? `song${m[1]}_voriginal_${m[2]}` : key;
}
