/**
 * Testet den Schreibzugriff (ECG-.chordpro hochladen + löschen) am Test-Lied „Treu".
 * Nutzt denselben Backend-Code wie die App. Räumt am Ende wieder auf.
 *
 * Aufruf:  npx tsx server/scripts/test-editor.ts
 */
import 'dotenv/config';
import { getSong } from '../src/services/churchtools.js';
import { saveEcgChordpro, deleteEcgChordpro } from '../src/services/setlistBuilder.js';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const SONG_ID = 21;
const ARR_ID = 27;

async function sessionFromToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${TOKEN}`);
  const setCookie =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''];
  for (const c of setCookie) {
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) return m[1];
  }
  throw new Error('Kein Session-Cookie');
}

async function listFiles(cookie: string): Promise<string[]> {
  const song = await getSong(cookie, SONG_ID);
  const arr = song.arrangements.find((a) => a.id === ARR_ID);
  return (arr?.files ?? []).map((f) => f.name);
}

async function main() {
  const cookie = await sessionFromToken();

  console.log('Dateien VORHER:', await listFiles(cookie));

  const text = `{title: Treu}
{key: E}
{comment: ECG-Test}
[E]Dies ist eine [A]Test-Bearbeitung [B]der ECG-Version`;

  console.log('\n→ Speichere ECG-Version …');
  await saveEcgChordpro(cookie, SONG_ID, ARR_ID, text);
  const after = await listFiles(cookie);
  console.log('Dateien NACH Speichern:', after);
  const ecg = after.find((n) => /ecg/i.test(n) && /\.chordpro$/i.test(n));
  console.log(ecg ? `✓ ECG-Datei angelegt: ${ecg}` : '✗ ECG-Datei NICHT gefunden!');

  console.log('\n→ Lösche ECG-Version wieder (Aufräumen) …');
  await deleteEcgChordpro(cookie, SONG_ID, ARR_ID);
  const cleaned = await listFiles(cookie);
  console.log('Dateien NACH Löschen:', cleaned);
  const stillThere = cleaned.find((n) => /ecg/i.test(n) && /\.chordpro$/i.test(n));
  console.log(stillThere ? '✗ ECG-Datei noch da!' : '✓ wieder sauber – Original unberührt.');
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
