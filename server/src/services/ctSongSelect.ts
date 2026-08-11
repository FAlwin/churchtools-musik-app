/**
 * CCLI SongSelect über ChurchTools (#322) – die App als **Fernbedienung**.
 *
 * **Warum das geht, obwohl SongSelect zertifizierten Partnern vorbehalten ist:** Nicht wir fragen bei
 * CCLI an, sondern ChurchTools. Es ist der zertifizierte Partner, die Gemeinde hat das Abo, und diese
 * Datei löst nur aus, was in der ChurchTools-Oberfläche ohnehin vorhanden ist – mit dem Cookie des
 * Nutzers und seinem CSRF-Token.
 *
 * **DIE EINZIGE STELLE, DIE DIE ALTE SCHNITTSTELLE ANSPRICHT.** `POST /index.php?q=churchservice/ajax`
 * ist **undokumentiert und intern**; sie kann sich mit einem ChurchTools-Update ohne Ankündigung
 * ändern. Deshalb liegt sie hinter genau einer Funktion (`ctAjax`): Ein Update trifft dann einen Ort,
 * nicht fünf. Alles andere im Projekt geht weiter über `/api/` – siehe `ctRead`/`ctWrite`.
 *
 * Vollständig gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 *
 * **Hier stehen nur die LESENDEN Aufrufe** (Suche, Abfrage). Sie ändern nichts und dürfen beliebig
 * wiederholt werden. Das Herunterladen legt eine Datei an und kommt bewusst später, an einer eigenen
 * Stelle mit eigener Rückfrage.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { csrfWriteDenied, getCsrfToken } from './ctCsrf.js';
import { BASE, CT_FILE_TIMEOUT_MS, ctSignal } from './ctHttp.js';
import type { SongSelectSong, SongSelectTreffer } from '@shared/types/index';

/**
 * Ein Aufruf der alten ChurchTools-Schnittstelle.
 *
 * **Warum ein CSRF-Token, obwohl nichts geschrieben wird:** Die alte Schnittstelle verlangt es für
 * jeden Aufruf, auch für lesende – so macht es die ChurchTools-Oberfläche selbst (gemessen). Wir
 * benutzen denselben Weg wie alle Schreibvorgänge (`getCsrfToken`), damit es genau eine Stelle gibt,
 * die Tokens holt und bei Ablehnung verwirft (#298).
 *
 * **Die längere Zeitgrenze ist kein Luxus:** Der Aufruf geht über ChurchTools **weiter zu CCLI**.
 * Gemessen ~800 ms; ein normales API-Zeitlimit wäre zu knapp und würde Suchen abbrechen, die
 * gerade noch funktionieren.
 *
 * **Die Antwort ist doppelt verpackt:** außen `{status, data}` von ChurchTools, und `data` ist eine
 * **Zeichenkette**, in der die Antwort von CCLI steckt. Das ist keine Schönheit, sondern der
 * gemessene Ist-Zustand – und der Grund, warum das Auspacken hier einmal steht und nicht bei jedem
 * Aufrufer.
 */
async function ctAjax(
  cookie: string,
  func: string,
  felder: Record<string, string>,
): Promise<unknown> {
  const csrf = await getCsrfToken(cookie);
  const body = new URLSearchParams({ func, ...felder });

  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    signal: ctSignal(CT_FILE_TIMEOUT_MS),
    method: 'POST',
    headers: {
      Cookie: cookie,
      'CSRF-Token': csrf,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // Ohne diesen Kopf antwortet die alte Schnittstelle mit einer HTML-Seite statt JSON.
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body,
  });

  if (res.status === 401 || res.status === 403) {
    csrfWriteDenied(cookie, 'Keine Berechtigung für CCLI SongSelect in ChurchTools.');
  }
  if (!res.ok) {
    throw new HttpError(502, `ChurchTools hat die SongSelect-Anfrage abgelehnt (${res.status}).`);
  }

  const roh = await res.text();
  let aussen: { status?: string; data?: unknown; message?: string };
  try {
    aussen = JSON.parse(roh) as typeof aussen;
  } catch {
    // Kommt vor, wenn die Sitzung abgelaufen ist: Dann liefert das alte Modul eine Anmeldeseite.
    throw new HttpError(502, 'ChurchTools lieferte keine lesbare Antwort für SongSelect.');
  }
  if (aussen.status !== 'success') {
    throw new HttpError(502, aussen.message ?? 'SongSelect-Anfrage fehlgeschlagen.');
  }
  // `data` ist eine Zeichenkette mit JSON darin – die Antwort von CCLI.
  if (typeof aussen.data !== 'string') return aussen.data;
  try {
    return JSON.parse(aussen.data);
  } catch {
    throw new HttpError(502, 'Die Antwort von CCLI war nicht lesbar.');
  }
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
): Promise<{ treffer: SongSelectTreffer[]; gesamt: number; vollstaendig: boolean }> {
  const titel = songTitle.trim();
  if (!titel) throw new HttpError(400, 'Bitte einen Titel eingeben.');

  const antwort = (await ctAjax(cookie, 'getCCLISongsMatchingTitle', { songTitle: titel })) as {
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
  const antwort = (await ctAjax(cookie, 'getCCLISongData', {
    songNumber: String(songNumber),
  })) as { data?: CtSongSelectRoh };
  const roh = antwort.data;
  if (!roh?.songNumber) {
    throw new HttpError(404, `Zur CCLI-Nummer ${songNumber} wurde nichts gefunden.`);
  }
  return { ...treffer(roh), copyright: roh.copyrights?.[0] ?? null };
}
