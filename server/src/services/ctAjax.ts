/**
 * **Die einzige Stelle, die die alte ChurchTools-Schnittstelle anspricht** (#322).
 *
 * `POST /index.php?q=churchservice/ajax` ist **undokumentiert und intern**; sie kann sich mit einem
 * ChurchTools-Update ohne Ankündigung ändern. Deshalb liegt sie hinter genau einer Funktion: Ein
 * Update trifft dann einen Ort, nicht fünf. Alles andere im Projekt geht über `/api/` – siehe
 * `ctRead`/`ctWrite`.
 *
 * **Warum als eigenes Modul:** Sie stand ursprünglich privat in `ctSongSelect.ts`, weil SongSelect der
 * erste Nutzer war. Mit den Lied-Kategorien kam ein zweiter (`ctSongCategories.ts`) – und damit die
 * Wahl zwischen einer zweiten Fassung daneben oder einem Import aus dem SongSelect-Modul, das
 * fachlich nichts mit Kategorien zu tun hat. Beides wäre falsch: Das Projekt hat seine teuersten
 * Fehler damit gemacht, dass dieselbe Regel an mehreren Stellen stand (#280, #359). Wer sie hier
 * ändert, ändert sie für alle Nutzer.
 *
 * **Warum ein CSRF-Token, obwohl auch nur gelesen wird:** Die alte Schnittstelle verlangt es für
 * jeden Aufruf – so macht es die ChurchTools-Oberfläche selbst (gemessen). Wir nehmen denselben Weg
 * wie alle Schreibvorgänge (`getCsrfToken`), damit es eine Stelle gibt, die Tokens holt und bei
 * Ablehnung verwirft (#298).
 *
 * Vollständig gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { csrfWriteDenied, getCsrfToken } from './ctCsrf.js';
import { BASE, CT_FILE_TIMEOUT_MS, ctSignal } from './ctHttp.js';

/**
 * Die Meldungen eines Aufrufs – **durchgereicht, nicht generisch** (Muster von `uploadFile`).
 *
 * Als die Funktion noch privat in `ctSongSelect.ts` stand, sprachen ihre Meldungen von SongSelect
 * („ChurchTools hat die SongSelect-Anfrage abgelehnt"). Beim Herausziehen wären sie zu „die Anfrage"
 * verwaschen – für den Nutzer ein Verlust, denn ein Fehler beim Liedersuchen und einer beim Laden der
 * Kategorien sind verschiedene Dinge. Genau diese Abwägung ist bei `uploadChordpro` schon einmal so
 * entschieden worden: Der Baustein wird geteilt, der Wortlaut bleibt beim Aufrufer.
 */
export interface AjaxMeldungen {
  /** 401/403 – ChurchTools verweigert. */
  verweigert?: string;
  /** Anderer HTTP-Fehlschlag; bekommt den Statuscode angehängt. */
  abgelehnt?: string;
  /** Antwort war kein lesbares JSON (typisch: abgelaufene Sitzung → HTML-Anmeldeseite). */
  unlesbar?: string;
  /** `status` war nicht `success` und ChurchTools nannte keinen Grund. */
  fehlgeschlagen?: string;
  /**
   * Die **innere** Nutzlast war kein lesbares JSON – ein anderer Fall als `unlesbar`.
   *
   * Bei SongSelect ist das der Unterschied zwischen „ChurchTools hat nicht sauber geantwortet" und
   * „CCLI hat nicht sauber geantwortet". Wer den Fehler liest, will wissen, welches der beiden
   * Systeme klemmt.
   */
  innenUnlesbar?: string;
}

/**
 * Ein Aufruf der alten Schnittstelle. Liefert die **ausgepackte** Antwort.
 *
 * **Die längere Zeitgrenze ist kein Luxus:** Die SongSelect-Aufrufe gehen über ChurchTools **weiter zu
 * CCLI** (gemessen ~800 ms); ein normales API-Zeitlimit würde Suchen abbrechen, die gerade noch
 * funktionieren. Sie gilt hier für alle Aufrufe – die anderen sind schneller, und eine zweite
 * Zeitgrenze daneben wäre eine Zahl, die irgendwann von der ersten abweicht.
 *
 * **Die Antwort ist doppelt verpackt:** außen `{status, data}` von ChurchTools, und `data` ist je nach
 * Aufruf eine **Zeichenkette** mit JSON darin oder direkt ein Objekt. Das ist keine Schönheit,
 * sondern der gemessene Ist-Zustand – und der Grund, warum das Auspacken hier einmal steht und nicht
 * bei jedem Aufrufer.
 */
export async function ctAjax(
  cookie: string,
  func: string,
  felder: Record<string, string> = {},
  meldungen: AjaxMeldungen = {},
): Promise<unknown> {
  const {
    verweigert = 'Keine Berechtigung für diese ChurchTools-Funktion.',
    abgelehnt = 'ChurchTools hat die Anfrage abgelehnt',
    unlesbar = 'ChurchTools lieferte keine lesbare Antwort.',
    fehlgeschlagen = 'Die ChurchTools-Anfrage ist fehlgeschlagen.',
    innenUnlesbar = 'Die Antwort von ChurchTools war nicht lesbar.',
  } = meldungen;
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

  if (res.status === 401 || res.status === 403) csrfWriteDenied(cookie, verweigert);
  if (!res.ok) {
    throw new HttpError(502, `${abgelehnt} (${res.status}).`);
  }

  const roh = await res.text();
  let aussen: { status?: string; data?: unknown; message?: string };
  try {
    aussen = JSON.parse(roh) as typeof aussen;
  } catch {
    // Kommt vor, wenn die Sitzung abgelaufen ist: Dann liefert das alte Modul eine Anmeldeseite.
    throw new HttpError(502, unlesbar);
  }
  if (aussen.status !== 'success') {
    throw new HttpError(502, aussen.message ?? fehlgeschlagen);
  }
  /**
   * **Drei gemessene Formen von `data`** – alle kommen wirklich vor:
   *  - SongSelect-Suche und -Abfrage: `data` ist eine **Zeichenkette** mit der CCLI-Antwort darin.
   *  - SongSelect-Herunterladen: `data` ist ein Objekt `{ success, content }`, und erst `content` ist
   *    die Zeichenkette.
   *  - `getMasterData`: `data` ist direkt ein **Objekt** (Kategorien, Dienste, …).
   */
  const roh2: unknown =
    typeof aussen.data === 'object' && aussen.data !== null && 'content' in aussen.data
      ? aussen.data.content
      : aussen.data;
  if (typeof roh2 !== 'string') return roh2;
  try {
    return JSON.parse(roh2);
  } catch {
    throw new HttpError(502, innenUnlesbar);
  }
}
