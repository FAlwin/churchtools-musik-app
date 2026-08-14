/**
 * Dateien aus ChurchTools lesen – mit Größenbegrenzung (#280).
 *
 * Der Datei-Proxy las früher jede Datei vollständig in den Speicher, ohne Limit: Ein hochgeladener
 * Riesen-Scan hätte den Container umgelegt und damit die App für ALLE (#248). Deshalb prüft
 * `readLimited` erst die angekündigte Größe und zählt dann beim Lesen mit – `Content-Length` kann
 * fehlen ODER lügen.
 *
 * `assertCtFileUrl` ist die Absicherung gegen einen Fremd-Server: Nur URLs der eigenen Instanz
 * werden abgerufen.
 */
import { HttpError } from '../middleware/errorHandler.js';
import {
  BASE,
  CT_FILE_TIMEOUT_MS,
  MAX_FILE_BYTES,
  asGatewayError,
  ctSignal,
  fileDownloadError,
  readLimited,
} from './ctHttp.js';

/**
 * Wächter: Datei-URLs kommen aus ChurchTools-DATEN (Arrangements können auch freie Link-Einträge
 * enthalten). Das Session-Cookie darf nur an die eigene CT-Instanz gehen – sonst könnte ein
 * präparierter Link-Eintrag die Cookies der App-Nutzer an einen Fremdhost leiten.
 */
function assertCtFileUrl(fileUrl: string): void {
  if (!fileUrl.startsWith(`${BASE}/`)) {
    throw new HttpError(502, 'Datei-Download abgelehnt: URL gehört nicht zur ChurchTools-Instanz.');
  }
}

/** Lädt eine Arrangement-Datei (z.B. .chordpro) als Text – mit Session-Cookie. */
export async function downloadFileText(cookie: string, fileUrl: string): Promise<string> {
  assertCtFileUrl(fileUrl);
  try {
    // `redirect: 'manual'` (#199): assertCtFileUrl prüft den Host der ANGEFRAGTEN URL – ohne diese
    // Zeile würde fetch einer Weiterleitung folgen und das CT-Cookie mitnehmen. Ein Open Redirect in
    // der eigenen CT-Instanz könnte es so abfließen lassen.
    const res = await fetch(fileUrl, {
      headers: { Cookie: cookie },
      redirect: 'manual',
      signal: ctSignal(CT_FILE_TIMEOUT_MS),
    });
    if (!res.ok) fileDownloadError(res.status, res.headers.get('retry-after'));
    // Auch ChordPro-Text gedeckelt (#248): Es ist eine Datei aus ChurchTools und kann alles sein.
    return (await readLimited(res, MAX_FILE_BYTES)).toString('utf8');
  } catch (e) {
    asGatewayError(e, 'Datei-Download (Text)');
  }
}

/** Extrahiert die Datei-ID aus einer ChurchTools-fileUrl (…&id=213&…). */
export function fileIdFromUrl(fileUrl: string): number | null {
  const m = fileUrl.match(/[?&]id=(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Lädt eine Datei als Bytes + Content-Type (zum Durchreichen an den Client). */
export async function fetchFileBytes(
  cookie: string,
  fileUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  assertCtFileUrl(fileUrl);
  try {
    // Wie in downloadFileText: keinen Weiterleitungen folgen, damit das CT-Cookie die geprüfte
    // Instanz nicht verlässt (#199). Verifiziert: ChurchTools liefert Dateien direkt mit 200 aus.
    const res = await fetch(fileUrl, {
      headers: { Cookie: cookie },
      redirect: 'manual',
      signal: ctSignal(CT_FILE_TIMEOUT_MS),
    });
    if (!res.ok) fileDownloadError(res.status, res.headers.get('retry-after'));
    // Gedeckelt lesen statt `arrayBuffer()` (#248) – sonst landet eine beliebig große Datei
    // vollständig im Speicher des Containers.
    const buffer = await readLimited(res, MAX_FILE_BYTES);
    return { buffer, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
  } catch (e) {
    asGatewayError(e, 'Datei-Download (Bytes)');
  }
}
