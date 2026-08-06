/**
 * Das HTTP-Fundament für alle ChurchTools-Aufrufe (#280).
 *
 * Hier liegen Zeitgrenzen, Größenbegrenzung und die **Abbildung fremder Fehler auf unsere**. Das ist
 * kein Beiwerk: Erst weil die Abbildung an EINER Stelle steht, konnte #300 die Drosselung (429) von
 * einem echten Ausfall unterscheiden – vorher war beides ein 502 und damit nicht behandelbar.
 *
 * **Zwei Regeln, die hier verankert sind:**
 *  - *Vorübergehend ist nicht ungültig* – Zeitüberschreitung wird 504, Drosselung 503, beides mit
 *    einem eigenen Fehlertyp, damit Aufrufer sie erkennen statt zu raten.
 *  - Ein 429 wird **nicht** als 429 weitergereicht: Der Client deutet das als „zu viele
 *    Anmeldeversuche". Begründung an `CtOverloadedError`.
 */
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';

export const BASE = config.churchtoolsBaseUrl.replace(/\/$/, '');

/**
 * Zeitgrenzen für ChurchTools-Aufrufe (#248).
 *
 * Ohne Grenze wartet eine Anfrage unbegrenzt, wenn ChurchTools hängt – der Node-Prozess sammelt dann
 * offene Requests, bis nichts mehr geht. Die App pollt im Sekundentakt, das potenziert sich.
 * Dateien dürfen länger dauern als API-Aufrufe (große PDFs über eine schmale Leitung).
 */
const CT_TIMEOUT_MS = 15_000;

export const CT_FILE_TIMEOUT_MS = 60_000;

/**
 * Obergrenze für durchgereichte Dateien (#248).
 *
 * Der Datei-Proxy hält die Datei **komplett im Speicher**. Ein versehentlich in ChurchTools
 * hochgeladener Scan von mehreren hundert MB würde den Container umlegen – und damit die App für
 * ALLE gleichzeitig. 50 MB liegen weit über jedem realen Liedblatt oder Notensatz.
 *
 * Bewusst **nur für Dateien**, nicht für die JSON-Antworten der CT-API (`ctGet`): Dort bestimmt die
 * Datenmenge der Gemeinde die Größe – ein paar hundert Lieder oder Ablaufpunkte –, und es gibt keinen
 * Weg, sie von außen aufzublähen. Ein Limit dort wäre Aufwand ohne Schutzgewinn. Dateien dagegen sind
 * beliebige Uploads.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Ein Abbruch-Signal mit Zeitgrenze – die Zahlen stehen nur oben. */
export function ctSignal(ms: number = CT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Antwort-Rumpf lesen, aber **höchstens** `maxBytes` (#248).
 *
 * Zuerst die angekündigte Größe prüfen (spart das Laden ganz), dann beim Lesen mitzählen – ein
 * `Content-Length` kann fehlen oder lügen, deshalb reicht die Ankündigung allein nicht.
 *
 * Exportiert, damit die Grenze mit einem kleinen `maxBytes` prüfbar ist – ein Test mit den echten
 * 50 MB würde nur Speicher und Zeit kosten, ohne mehr zu beweisen.
 */
export async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(502, 'Die Datei ist zu groß, um sie anzuzeigen.');
  }
  if (!res.body) return Buffer.alloc(0);
  // Ohne die Angabe ist `value` ein `any` und alles daran hängende ungeprüft (#279).
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel(); // Verbindung abbrechen, statt weiter Speicher zu füllen
      throw new HttpError(502, 'Die Datei ist zu groß, um sie anzuzeigen.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Nicht-ok-Antwort eines Datei-Downloads in einen Fehler übersetzen (#274).
 *
 * **404 bleibt 404**: Die Datei ist in ChurchTools wirklich weg, „leer" ist dann die Wahrheit. Alles
 * andere (502/503, Serverfehler) ist vorübergehend und darf vom Aufrufer NICHT als leere Datei
 * durchgehen. Dieselbe Unterscheidung, die `ctGet` seit #152/#199 macht.
 *
 * Steht als Helfer da, weil die Zeile vorher an ZWEI Stellen wortgleich stand (`downloadFileText`
 * und `fetchFileBytes`) – eine davon zu ändern wäre die nächste halb umgesetzte Regel gewesen.
 */
export function fileDownloadError(status: number): never {
  throw new HttpError(status === 404 ? 404 : 502, `Datei-Download fehlgeschlagen (${status}).`);
}

/**
 * Zeitüberschreitungen als 504 melden, nicht als 500 (#248): Der Fehler liegt beim Upstream, und der
 * Client soll „später nochmal" unterscheiden können von „echter Fehler".
 */
export function asGatewayError(e: unknown, was: string): never {
  if (e instanceof HttpError) throw e;
  if (isTimeout(e)) {
    console.warn(`[churchtools] Zeitüberschreitung bei ${was}`);
    throw new HttpError(504, 'ChurchTools antwortet gerade nicht. Bitte später erneut versuchen.');
  }
  throw e;
}

/** Abbruch wegen Zeitüberschreitung – eine Stelle, damit `asGatewayError` und `isCtOverloaded` dasselbe meinen. */
function isTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
}

/**
 * ChurchTools drosselt uns (HTTP 429) – als eigene Fehlerklasse (#300).
 *
 * **Warum 503 und nicht 429 nach außen:** Ein 429 aus unserer API würde im Client als „zu viele
 * Anmeldeversuche" gedeutet (`utils/loginError.ts`) und damit die falsche Ursache behaupten. Ein 503
 * **mit** unserem `{error}`-Rumpf fällt dagegen in den vorhandenen „Server hat ein Problem"-Zweig,
 * kippt die App dank #296 NICHT in den Offline-Zustand und lässt die bestehenden Meldungen unverändert.
 * Null Verhaltensänderung im Client, voller Diagnosegewinn.
 */
export class CtOverloadedError extends HttpError {
  constructor(retryAfterMs?: number) {
    super(
      503,
      'ChurchTools bremst uns gerade aus (zu viele Anfragen). Bitte einen Moment warten.',
      retryAfterMs,
    );
    this.name = 'CtOverloadedError';
  }
}

/**
 * `Retry-After` lesen – beide erlaubten Formen (#300): Sekunden als Zahl **oder** ein HTTP-Datum.
 * `undefined`, wenn der Kopf fehlt oder unbrauchbar ist; nie ein negativer Wert.
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const sekunden = Number(header.trim());
  if (Number.isFinite(sekunden)) return Math.max(0, sekunden * 1000);
  const datum = Date.parse(header);
  if (Number.isNaN(datum)) return undefined;
  return Math.max(0, datum - now);
}

/**
 * „ChurchTools kann gerade nicht mehr" – Drosselung ODER Zeitüberschreitung (#300).
 *
 * Beides heißt für einen Massenlauf dasselbe: **sofort aufhören**, statt weitere hundert Anfragen in
 * eine Wand zu schicken. Die Zeitüberschreitung gehört dazu, weil `ctGet` nicht über `asGatewayError`
 * läuft – dort fliegt ein Timeout als rohe `TimeoutError` heraus.
 */
export function isCtOverloaded(e: unknown): boolean {
  return e instanceof CtOverloadedError || isTimeout(e);
}

/** Führt eine authentifizierte JSON-Anfrage gegen die ChurchTools-API aus. */
export async function ctGet<T = unknown>(cookie: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    signal: ctSignal(),
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  if (res.status === 401) {
    throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
  }
  // 403 NICHT als 401 werten (#152): Ein transienter Proxy-/Rechte-403 (z. B. Alt-Cookie, kein
  // Cache) darf keinen 401 erzeugen – sonst löst der globale „Session abgelaufen"-Fänger (#186)
  // einen Zwangs-Logout samt Geräte-Wipe aus. Als 403 durchreichen (kein Re-Login).
  if (res.status === 403) {
    // Pfad NICHT nach außen geben (#199) – er verrät interne API-Struktur inkl. Personen-IDs.
    console.warn(`[churchtools] 403 bei ${path}`);
    throw new HttpError(403, 'Kein Zugriff auf diese ChurchTools-Daten.');
  }
  // 429 = ChurchTools drosselt uns (#300). Eigene Fehlerklasse, damit Massenläufe (Lied-Statistik)
  // beim ERSTEN Vorkommen abbrechen können, statt weitere hundert Anfragen in ein erschöpftes Limit
  // zu schicken – genau das hat im Betrieb die ganze App lahmgelegt (Anmeldung, Rechte, Speichern
  // bekamen danach ebenfalls 429). Vorher war das ein 502 unter vielen und nicht unterscheidbar.
  if (res.status === 429) {
    const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
    console.warn(
      `[churchtools] 429 (gedrosselt) bei ${path}` +
        (retryAfterMs === undefined ? '' : `, Retry-After ${Math.round(retryAfterMs / 1000)} s`),
    );
    throw new CtOverloadedError(retryAfterMs);
  }
  if (!res.ok) {
    // 404 durchreichen (z. B. „Termin hat keinen Ablaufplan") – Aufrufer wie die Statistik
    // unterscheiden das von echten Fehlern (500/Netz), die geloggt werden. Rest bleibt 502.
    // 404 NICHT loggen (#215): Der Fall ist erwartbar und würde im 8-Sekunden-Polling das
    // Container-Log fluten. Pfad ohnehin nur ins Log (#199), nach außen generisch.
    if (res.status !== 404) console.warn(`[churchtools] Fehler ${res.status} bei ${path}`);
    throw new HttpError(res.status === 404 ? 404 : 502, `ChurchTools-Fehler (${res.status}).`);
  }
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}
