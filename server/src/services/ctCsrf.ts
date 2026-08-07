/**
 * Das CSRF-Token für schreibende Anfragen: holen, wiederholen, bündeln, verwerfen (#280).
 *
 * Jede Schreibaktion braucht dieses Token. Drei Mechanismen sitzen hier, jeder mit eigener Geschichte:
 *  - **Ein Wiederholversuch** (#294): Das Holen ist ein reiner GET ohne Nebenwirkung – ein zweiter
 *    Versuch ist gefahrlos. Bewusst nur das TOKEN wird wiederholt, nicht der Schreibvorgang danach
 *    (ein Datei-Upload liefe sonst doppelt).
 *  - **Vorhalten** (#298): Ohne das kostete jedes Speichern einen zusätzlichen ChurchTools-Aufruf.
 *  - **Verwerfen bei Ablehnung** (#298): Sonst schickt der nächste Versuch dasselbe abgelehnte Token
 *    erneut – eine Sackgasse, aus der nur ein Neustart hülfe.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { BASE, ctSignal } from './ctHttp.js';
import { csrfCache, csrfInflight } from './ctSessionMemos.js';

/** Ein einzelner Versuch, ein CSRF-Token zu holen. */
async function fetchCsrfTokenOnce(cookie: string): Promise<string> {
  const res = await fetch(`${BASE}/api/csrftoken`, {
    signal: ctSignal(),
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  // Tote CT-Session als 401 durchreichen (nicht 502): Sonst wertet der Client das als „offline"
  // und der globale Re-Login greift nicht → „CSRF-Token konnte nicht geholt werden"-Sackgasse (#186).
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
  }
  if (!res.ok) {
    // Diagnostisch (#296): den ECHTEN ChurchTools-Status mitgeben. Dieser Fehler trat reproduzierbar
    // auf, während dieselbe Cookie-/fetch-Konfiguration bei allen anderen Endpunkten funktionierte –
    // ohne den Status ließ sich nicht sagen, ob CT drosselt (429), einen Serverfehler hat (5xx) oder
    // den Endpunkt/Request ablehnt (400/404/406). Der Body geht nur ins Log (kann interne Pfade
    // enthalten), der Status auch nach außen, weil er beim Einordnen hilft.
    const body = await res.text().catch(() => '');
    console.error(`[churchtools] csrftoken → HTTP ${res.status}; body: ${body.slice(0, 300)}`);
    throw new HttpError(
      502,
      `CSRF-Token konnte nicht geholt werden (ChurchTools: HTTP ${res.status}).`,
    );
  }
  const raw = await res.text();
  let json: { data?: string };
  try {
    json = JSON.parse(raw) as { data?: string };
  } catch {
    // res.ok, aber kein JSON (z. B. eine HTML-Seite nach einem Redirect) – auch das war bisher als
    // undurchsichtiger 500 erschienen. Jetzt sichtbar machen, statt beim `res.json()` blind zu werfen.
    console.error(`[churchtools] csrftoken → 200, aber kein JSON: ${raw.slice(0, 300)}`);
    throw new HttpError(502, 'CSRF-Token unlesbar (ChurchTools lieferte kein JSON).');
  }
  return json.data ?? '';
}

/** Pause zwischen den beiden Versuchen (#294). Klein genug, dass es beim Speichern nicht auffällt. */
export const CSRF_RETRY_DELAY_MS = 300;

/**
 * Der Wiederholversuch aus #294 – Begründung steht vollständig an `getCsrfToken` (dem einzigen
 * Aufrufer). Hier nur die Regel: 401 nicht wiederholen, alles andere genau einmal.
 */
async function fetchCsrfTokenWithRetry(cookie: string): Promise<string> {
  try {
    return await fetchCsrfTokenOnce(cookie);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw e; // tote Session → nicht wiederholen
    // Alles andere ist vorübergehend: einmal kurz warten und erneut versuchen. Klappt es wieder
    // nicht, fliegt der Fehler des ZWEITEN Versuchs (der aktuelle Zustand, nicht der alte).
    await new Promise((r) => setTimeout(r, CSRF_RETRY_DELAY_MS));
    return await fetchCsrfTokenOnce(cookie);
  }
}

/**
 * Zwischengespeichertes Token verwerfen (#298).
 *
 * Wird bei **jedem** abgelehnten Schreibvorgang (401/403) aufgerufen: Die Ablehnung kann daran liegen,
 * dass ChurchTools dieses Token nicht mehr akzeptiert. Dann muss der nächste Versuch ein frisches
 * holen, statt dasselbe abgelehnte erneut zu schicken – sonst hätte der Cache eine dauerhafte
 * Sackgasse gebaut, aus der nur ein Neustart hilft.
 */
function invalidateCsrfToken(cookie: string): void {
  csrfCache.delete(cookie);
}

/**
 * Holt ein CSRF-Token für schreibende Anfragen – **zwischengespeichert** (#298) und mit **einem**
 * automatischen Wiederholversuch (#294).
 *
 * Jede Schreibaktion (Ablauf speichern, Lied hochladen, …) holte dieses Token vorher **jedes Mal neu**.
 * Ein Speichervorgang kostete damit einen zusätzlichen ChurchTools-Aufruf, Umsortieren per Ziehen
 * gleich mehrere in Folge. Beim Testen zu mehreren trat reproduzierbar „CSRF-Token konnte nicht geholt
 * werden" auf, während alle anderen Endpunkte mit demselben Cookie funktionierten – das Bild einer
 * Drosselung genau dieses Endpunkts. Bewiesen ist die Drosselung nicht (der Statuscode wurde nie
 * gesehen, siehe #296); der Cache hilft aber unabhängig davon, weil er die Zahl der Anfragen an die
 * empfindlichste Stelle des Schreibpfads drastisch senkt.
 *
 * Zwei Sparmechanismen:
 *  - **TTL-Cache je Sitzung** (eine Minute) – Folge-Speichervorgänge holen kein neues Token.
 *  - **Bündelung paralleler Abrufe** – mehrere gleichzeitige Schreibvorgänge lösen EINEN GET aus.
 *
 * Das Token-Holen ist ein reiner GET ohne Nebenwirkung – ein zweiter Versuch ist gefahrlos. Dieselbe
 * Lehre wie #245/#270 („vorübergehend ≠ ungültig“), hier auf dem Schreibpfad. **Bewusst nur das Token
 * wird wiederholt, NICHT der eigentliche Schreibvorgang danach** – der ist nicht überall idempotent
 * (ein Datei-Upload würde sonst doppelt laufen).
 *
 * Ein **401/403** (tote Session) wird NICHT wiederholt: Das ändert sich beim zweiten Versuch nicht und
 * würde nur den Weg zum Login verzögern.
 */
export async function getCsrfToken(cookie: string): Promise<string> {
  const hit = csrfCache.get(cookie);
  if (hit !== undefined) return hit;

  const laufend = csrfInflight.get(cookie);
  if (laufend) return laufend; // parallelen Schreibvorgang mitnutzen statt zweiten GET auslösen

  const abruf = (async () => {
    try {
      const token = await fetchCsrfTokenWithRetry(cookie);
      // Nur merken, wenn zwischenzeitlich kein Abmelden dazwischenkam: `forgetSession` entfernt den
      // Eintrag: Ohne diese Prüfung landete das Token NACH dem Abmelden im Speicher und ein totes
      // Cookie hätte eine Minute lang eines gehabt.
      //
      // Bewusst über `has` statt über Promise-Identität: Der Selbstbezug ginge nur mit einer zweiten
      // Map, und der verbleibende Sonderfall ist winzig – meldet sich jemand ab und SOFORT wieder an,
      // während derselbe Abruf noch läuft, wird das alte Token einmal gemerkt. Es ist dann höchstens
      // eine Minute alt, und der erste abgelehnte Schreibvorgang wirft es ohnehin weg (#298).
      if (csrfInflight.has(cookie)) csrfCache.set(cookie, token);
      return token;
    } finally {
      csrfInflight.delete(cookie);
    }
  })();
  csrfInflight.set(cookie, abruf);
  return abruf;
}

/**
 * Ein abgelehnter Schreibvorgang (401/403): Fehler melden UND das zwischengespeicherte Token
 * verwerfen (#298). Sonst schickt der nächste Versuch dasselbe abgelehnte Token – eine Sackgasse,
 * aus der nur ein Neustart hülfe.
 *
 * Entstanden, weil **sieben** Schreibfunktionen dasselbe tun mussten und genau eine davon es
 * vergessen hätte. Seit #280 ruft nur noch der Helfer `schreibe` in `ctWrite.ts` hier an – die Regel
 * gilt damit für jede Schreiboperation, ohne dass jemand daran denken muss.
 */
export function csrfWriteDenied(cookie: string, meldung: string): never {
  invalidateCsrfToken(cookie);
  throw new HttpError(403, meldung);
}

/** Nur für Tests: den Schreibpfad an seiner empfindlichsten Stelle (Token-Holen) prüfbar machen. */
export const __getCsrfTokenForTests = getCsrfToken;
