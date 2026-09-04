/**
 * CCLI SongSelect über ChurchTools (#322) – die App als **Fernbedienung**.
 *
 * **Warum das geht, obwohl SongSelect zertifizierten Partnern vorbehalten ist:** Nicht wir fragen bei
 * CCLI an, sondern ChurchTools. Es ist der zertifizierte Partner, die Gemeinde hat das Abo, und diese
 * Datei löst nur aus, was in der ChurchTools-Oberfläche ohnehin vorhanden ist – mit dem Cookie des
 * Nutzers und seinem CSRF-Token.
 *
 * **Die alte Schnittstelle wird hier nicht selbst angesprochen.** `POST /index.php?q=churchservice/ajax`
 * ist undokumentiert und intern; sie liegt hinter `ctAjax.ts` – der einzigen Stelle, die sie kennt.
 * Bis #322/Schritt 7 stand diese Funktion privat hier, weil SongSelect ihr erster Nutzer war; mit den
 * Lied-Kategorien kam ein zweiter, und eine zweite Fassung daneben ist die Fehlerklasse, die dieses
 * Projekt am häufigsten getroffen hat. Alles andere im Projekt geht über `/api/` – siehe
 * `ctRead`/`ctWrite`.
 *
 * Vollständig gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 *
 * **Hier stehen die Aufrufe rund um CCLI.** Suche und Abfrage ändern nichts und dürfen beliebig
 * wiederholt werden; `fetchChordProText` holt nur Text und legt selbst keine Datei an (siehe dort).
 */
import { HttpError } from '../middleware/errorHandler.js';
import { ctAjax, type AjaxMeldungen } from './ctAjax.js';
import type {
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongSelectTreffer,
} from '@shared/types/index';

/**
 * Die SongSelect-Wortlaute – **wortgleich wie vor dem Herausziehen**.
 *
 * Sie stehen hier und nicht in `ctAjax`, weil ein Fehler beim Liedersuchen etwas anderes ist als
 * einer beim Laden der Kategorien. Wichtig ist die Trennung der letzten beiden: „ChurchTools
 * antwortete nicht lesbar" heißt, unser Vermittler klemmt; „Die Antwort von CCLI war nicht lesbar"
 * heißt, die Gegenstelle dahinter.
 */
const SS_MELDUNGEN: AjaxMeldungen = {
  verweigert: 'Keine Berechtigung für CCLI SongSelect in ChurchTools.',
  abgelehnt: 'ChurchTools hat die SongSelect-Anfrage abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Antwort für SongSelect.',
  fehlgeschlagen: 'SongSelect-Anfrage fehlgeschlagen.',
  innenUnlesbar: 'Die Antwort von CCLI war nicht lesbar.',
};

/** Ein SongSelect-Aufruf über die alte Schnittstelle, mit den Meldungen von oben. */
function ssAjax(cookie: string, func: string, felder: Record<string, string>): Promise<unknown> {
  return ctAjax(cookie, func, felder, SS_MELDUNGEN);
}

/** Was CCLI je Format meldet: Gibt es das, und deckt die Lizenz der Gemeinde es ab? */
interface CtInhalt {
  exists?: boolean;
  isAuthorized?: boolean;
}

/**
 * **Verfügbar heißt: vorhanden UND lizenziert.**
 *
 * `exists` allein genügt nicht – ein Knopf für etwas, das CCLI dann verweigert, führt ins Leere.
 * Deshalb wird beides verlangt, und zwar an dieser einen Stelle statt bei jedem Feld erneut.
 */
function verfuegbar(i: CtInhalt | undefined): boolean {
  return i?.exists === true && i.isAuthorized === true;
}

/** Ein Treffer/Lied, wie CCLI es liefert – nur die Felder, die wir wirklich lesen. */
interface CtSongSelectRoh {
  songNumber?: number;
  title?: string;
  authors?: string[];
  copyrights?: string[];
  defaultKey?: string[];
  isPublicDomain?: boolean;
  content?: Record<string, CtInhalt>;
}

/**
 * Aus CCLIs Rohform unsere.
 *
 * **Bewusst nicht alles durchreichen:** Die Antwort enthält auch die Konto-Nummer der Gemeinde bei
 * CCLI, interne IDs und Links zur CCLI-API. Das gehört nicht in den Browser – es hilft niemandem und
 * wäre nur eine weitere Stelle, an der Interna nach außen sickern.
 */
function treffer(r: CtSongSelectRoh): SongSelectTreffer {
  return {
    songNumber: r.songNumber ?? 0,
    title: r.title ?? '',
    authors: r.authors ?? [],
    // `defaultKey` ist eine Liste und kann LEER sein (Lieder ohne hinterlegte Tonart, gemessen).
    defaultKey: r.defaultKey?.[0] ?? null,
    isPublicDomain: r.isPublicDomain === true,
    hasLyrics: verfuegbar(r.content?.lyrics),
    hasChordPro: verfuegbar(r.content?.chordPro),
    hasChordSheet: verfuegbar(r.content?.chordSheet),
  };
}

/**
 * Nach Titel suchen (#322) – ändert nichts, beliebig wiederholbar.
 *
 * **Die Suche ist unscharf.** „Wo ich auch stehe" ergab 147 Treffer quer durch den CCLI-Katalog.
 * `vollstaendig` sagt deshalb, ob noch mehr da wären: ChurchTools holt 100 auf einmal, und einen
 * Weg zu weiteren Seiten hat die Messung **nicht** gefunden. Die Oberfläche soll dann zum
 * Verfeinern raten – und nicht so tun, als sei die Liste vollständig.
 */
export async function searchSongSelect(
  cookie: string,
  songTitle: string,
): Promise<SongSelectSuchergebnis> {
  const titel = songTitle.trim();
  if (!titel) throw new HttpError(400, 'Bitte einen Titel eingeben.');

  const antwort = (await ssAjax(cookie, 'getCCLISongsMatchingTitle', { songTitle: titel })) as {
    pagination?: { totalItems?: number };
    data?: { results?: CtSongSelectRoh[] };
  };
  const roh = antwort.data?.results ?? [];
  const gesamt = antwort.pagination?.totalItems ?? roh.length;
  return {
    treffer: roh.map(treffer),
    gesamt,
    vollstaendig: gesamt <= roh.length,
  };
}

/**
 * Ein Lied per CCLI-Nummer abfragen (#322) – ändert nichts.
 *
 * Liefert zusätzlich zum Treffer das **Copyright**: Beim Anlegen eines Liedes gehört es ins Formular,
 * und es steht nur in dieser Antwort, nicht in der Trefferliste der Suche.
 */
export async function getSongSelectSong(
  cookie: string,
  songNumber: number,
): Promise<SongSelectSong> {
  const antwort = (await ssAjax(cookie, 'getCCLISongData', {
    songNumber: String(songNumber),
  })) as { data?: CtSongSelectRoh };
  const roh = antwort.data;
  if (!roh?.songNumber) {
    throw new HttpError(404, `Zur CCLI-Nummer ${songNumber} wurde nichts gefunden.`);
  }
  return { ...treffer(roh), copyright: roh.copyrights?.[0] ?? null };
}

/** So liefert CCLI den Liedtext – gemessen am 14.08.2026 (`probe-ccli-lyrics.ts`). */
interface CtLyricsRoh {
  songNumber?: number;
  title?: string;
  authors?: string[];
  copyrights?: string[];
  disclaimer?: string;
  lyricParts?: { partLabel?: string; lyrics?: string }[];
}

/**
 * Den **Liedtext** eines SongSelect-Liedes holen (#379) – für die Vorschau vor dem Anlegen.
 *
 * **Gemessen, nicht geraten** (14.08.2026, `server/scripts/probe-ccli-lyrics.ts`): Der Aufruf heißt
 * `getCCLILyrics` und nimmt **`songNumber`** (nicht die interne `songID`). CCLI liefert den Text
 * **strukturiert** in `lyricParts` mit `partLabel` („Vers 1", „Chorus 1") – das wird durchgereicht,
 * statt es zu einem Block plattzumachen.
 *
 * ⚠️ **`disclaimer` MUSS mit angezeigt werden.** CCLI schickt ihn mit jedem Text mit („For use solely
 * with the SongSelect Terms of Use…"). Er ist eine Lizenzbedingung, keine Beigabe – deshalb geht er hier
 * durch bis in die Oberfläche.
 *
 * ⚠️ **Offen: Ob CCLI diesen Abruf als Nutzung verbucht.** Die Antwort enthält **kein** Feld, das darauf
 * hindeutet (gemessen: kein `reported`, `usage`, `count`) – das beweist aber nichts, denn eine Verbuchung
 * passiert bei CCLI und müsste sich hier nicht spiegeln. Belastbar wäre nur die Nutzungs-Historie im
 * SongSelect-Konto der Gemeinde. **Deshalb die Vorkehrung: Der Aufruf passiert nur, wenn jemand einen
 * Treffer bewusst öffnet – nie beim Durchsehen einer Liste –, und das Ergebnis wird je Nummer
 * zwischengespeichert.** Damit ist die Zahl der Abrufe die Zahl der wirklich angesehenen Lieder.
 */
export async function getSongSelectLyrics(
  cookie: string,
  songNumber: number,
): Promise<SongSelectLiedtext> {
  const antwort = (await ssAjax(cookie, 'getCCLILyrics', {
    songNumber: String(songNumber),
  })) as { data?: CtLyricsRoh };
  const roh = antwort.data;
  if (!roh?.lyricParts) {
    throw new HttpError(404, `Zur CCLI-Nummer ${songNumber} liefert SongSelect keinen Liedtext.`);
  }
  return {
    songNumber: roh.songNumber ?? songNumber,
    title: roh.title ?? '',
    authors: roh.authors ?? [],
    copyright: roh.copyrights?.[0] ?? null,
    // Abschnitte ohne Text fallen weg – eine leere Überschrift hilft niemandem.
    teile: roh.lyricParts
      .filter((t) => (t.lyrics ?? '').trim() !== '')
      .map((t) => ({ label: (t.partLabel ?? '').trim(), text: (t.lyrics ?? '').trim() })),
    disclaimer: roh.disclaimer?.trim() ?? null,
  };
}

/**
 * Den ChordPro-**Text** eines Liedes bei CCLI holen (#322, Schritt 9).
 *
 * **Diese Funktion legt KEINE Datei an – und genau das war mein Denkfehler.** Ich hatte angenommen,
 * `getCCLIChordPro` lege das Notenblatt in ChurchTools ab, wie es nach dem Klick in deren Oberfläche
 * aussieht. Gemessen am 11.08.2026: Der Aufruf **liefert den Text zurück** (`type: songChordPro`,
 * Feld `chordPro`); die ChurchTools-Oberfläche lädt ihn danach selbst als Datei hoch.
 *
 * Der Fehler war teuer: Der Aufrufer meldete „success", hat aber nichts angelegt – und die alte
 * Datei wurde trotzdem gelöscht. **Ein `status: success` ist kein Beleg dafür, dass etwas entstanden
 * ist.** Seitdem gilt: erst den Text in der Hand haben, dann selbst hochladen, dann aufräumen.
 *
 * Dass wir selbst hochladen, ist sogar der bessere Weg: Es läuft über `uploadFile` – unsere eigene,
 * geprüfte Stelle –, und der Dateiname liegt damit in unserer Hand.
 *
 * `tonality` bestimmt, in welcher Tonart CCLI liefert; `arrangementID` schickt die echte Oberfläche
 * mit, es bleibt der Vollständigkeit halber drin.
 */
export async function fetchChordProText(
  cookie: string,
  auftrag: { arrangementId: number; songNumber: number; title: string; tonality: string },
): Promise<string> {
  const antwort = (await ssAjax(cookie, 'getCCLIChordPro', {
    songNumber: String(auftrag.songNumber),
    title: auftrag.title,
    tonality: auftrag.tonality,
    arrangementID: String(auftrag.arrangementId),
  })) as { data?: { chordPro?: unknown } };

  const text = antwort.data?.chordPro;
  // Leer heißt: nichts geholt. Dann darf hinterher auch nichts gelöscht werden.
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new HttpError(502, 'CCLI hat kein Notenblatt geliefert.');
  }
  return text;
}
