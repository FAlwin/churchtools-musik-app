import { describe, it, expect, vi, afterEach } from 'vitest';
import { CtOverloadedError, isCtOverloaded, parseRetryAfter } from './ctHttp.js';
import { getEvents } from './ctRead.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * #300: ChurchTools drosselt uns mit **HTTP 429** – belegt im Betriebs-Log.
 *
 * Vorher war das ein 502 unter vielen und damit nicht unterscheidbar. Genau die Unterscheidung braucht
 * der Statistik-Lauf, um beim ERSTEN Vorkommen abzubrechen, statt weitere ~240 Anfragen in ein
 * erschöpftes Limit zu schicken (danach bekamen auch Anmeldung, Rechte und Speichern 429).
 *
 * **Warum 503 nach außen und nicht 429:** Ein 429 aus unserer API würde der Client als „zu viele
 * Anmeldeversuche" deuten (`utils/loginError.ts`) – falsche Ursache. Ein 503 **mit** unserem
 * `{error}`-Rumpf fällt in den vorhandenen „Server hat ein Problem"-Zweig und kippt die App dank #296
 * nicht in den Offline-Zustand. Null Verhaltensänderung im Client, voller Diagnosegewinn.
 */
function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 200 ? JSON.stringify({ data: [] }) : 'nope', { status, headers });
}

afterEach(() => vi.restoreAllMocks());

describe('ctGet – 429 wird als Drosselung erkannt (#300)', () => {
  it('429 ergibt CtOverloadedError mit Status 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(429));
    const fehler = await getEvents('cookie', '2026-01-01', '2026-12-31').catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(CtOverloadedError);
    expect(fehler).toMatchObject({ status: 503 });
  });

  it('Retry-After in SEKUNDEN wird übernommen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(429, { 'retry-after': '30' }));
    const fehler = (await getEvents('cookie', '2026-01-01', '2026-12-31').catch(
      (e: unknown) => e,
    )) as HttpError;

    expect(fehler.retryAfterMs).toBe(30_000);
  });

  it('404 und 500 bleiben unverändert (die Eingrenzung stimmt)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(404));
    await expect(getEvents('cookie', '2026-01-01', '2026-12-31')).rejects.toMatchObject({
      status: 404,
    });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(500));
    const f = await getEvents('cookie', '2026-01-01', '2026-12-31').catch((e: unknown) => e);
    expect(f).toMatchObject({ status: 502 });
    expect(f).not.toBeInstanceOf(CtOverloadedError);
  });
});

describe('parseRetryAfter – beide erlaubten Formen (#300)', () => {
  it('Sekunden als Zahl', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter('  5 ')).toBe(5_000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('HTTP-Datum – die zweite erlaubte Form, die man leicht vergisst', () => {
    const jetzt = Date.parse('2026-08-05T12:00:00Z');
    expect(parseRetryAfter('Wed, 05 Aug 2026 12:00:30 GMT', jetzt)).toBe(30_000);
  });

  it('ein Datum in der VERGANGENHEIT ergibt 0, nie etwas Negatives', () => {
    const jetzt = Date.parse('2026-08-05T12:00:00Z');
    expect(parseRetryAfter('Wed, 05 Aug 2026 11:00:00 GMT', jetzt)).toBe(0);
  });

  it('fehlender oder unbrauchbarer Kopf ergibt undefined', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('bald mal')).toBeUndefined();
  });
});

describe('isCtOverloaded – Drosselung UND Zeitüberschreitung (#300)', () => {
  it('erkennt die Drosselung', () => {
    expect(isCtOverloaded(new CtOverloadedError(1000))).toBe(true);
  });

  it('erkennt auch eine Zeitüberschreitung', () => {
    // Wichtig: `ctGet` läuft NICHT über `asGatewayError` – dort fliegt ein Timeout als rohe
    // TimeoutError heraus. Für einen Massenlauf heißt beides dasselbe: sofort aufhören.
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isCtOverloaded(timeout)).toBe(true);
    expect(isCtOverloaded(abort)).toBe(true);
  });

  it('ein normaler Serverfehler ist KEINE Überlast (sonst bricht ein 500er den Lauf ab)', () => {
    expect(isCtOverloaded(new HttpError(502, 'ChurchTools-Fehler (500).'))).toBe(false);
    expect(isCtOverloaded(new HttpError(404, 'nix'))).toBe(false);
    expect(isCtOverloaded(new Error('irgendwas'))).toBe(false);
    expect(isCtOverloaded(null)).toBe(false);
  });
});
