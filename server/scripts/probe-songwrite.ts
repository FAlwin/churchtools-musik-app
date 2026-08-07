/**
 * Erkundung: Lassen sich **Lieder und Arrangements** über die ChurchTools-API anlegen?
 *
 * Das ist die letzte offene Frage für den Wunsch „Liedverwaltung in der App". Lesen allein
 * beantwortet sie nicht – ob es `POST /api/songs` gibt, zeigt nur ein Versuch.
 *
 * **Wie das gefahrlos geht:** Gesendet wird ein LEERER Rumpf `{}`. Existiert der Endpunkt, antwortet
 * ChurchTools mit einem Validierungsfehler und nennt dabei die Pflichtfelder – anlegen kann er
 * nichts, weil sie alle fehlen. Gibt es ihn nicht, kommt 404. Beides ist die gesuchte Antwort.
 *
 * **ZWEI SPERREN, damit das nie die Gemeinde trifft:**
 *  1. Der Zugang steht in einer EIGENEN Datei `.env.churchtools-test` (Vorlage:
 *     `.env.churchtools-test.example`). Gibt es sie nicht, bricht das Skript ab – es kann
 *     also nicht versehentlich mit den Zugangsdaten der Arbeits-`.env` laufen.
 *  2. Ist dieser Wert gleich `CHURCHTOOLS_BASE_URL` (der Live-Instanz), bricht es ab. Ein
 *     Tippfehler in der `.env` darf nicht dazu führen, dass hier gegen die echte Gemeinde
 *     geschrieben wird.
 *
 * Aufruf:  npx tsx server/scripts/probe-songwrite.ts
 *
 * Bricht beim ersten 429 ab (#300). Tokens werden nie ausgegeben.
 */
import { config } from 'dotenv';

// Zwei Quellen, bewusst getrennt:
//  - die normale `.env` liefert die LIVE-Adresse – nur, um dagegen abzugleichen,
//  - `.env.churchtools-test` liefert den Test-Zugang.
// Die Arbeits-.env wird dabei NICHT verändert; existiert die Test-Datei nicht, bricht das
// Skript unten ab. So kann es ohne bewusstes Anlegen dieser Datei gar nicht laufen.
config();
config({ path: '.env.churchtools-test' });

const LIVE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const BASE = (process.env.CHURCHTOOLS_TEST_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_TEST_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error(
    '✗ Kein Test-Zugang gefunden.\n' +
      '  Dieses Skript läuft bewusst NUR gegen eine separate ChurchTools-Test-Instanz.\n' +
      '  Anlegen mit:  cp .env.churchtools-test.example .env.churchtools-test\n' +
      '  und dort CHURCHTOOLS_TEST_BASE_URL + CHURCHTOOLS_TEST_LOGIN_TOKEN eintragen.',
  );
  process.exit(1);
}

// Sperre 2: niemals gegen die Live-Instanz.
if (LIVE && BASE.toLowerCase() === LIVE.toLowerCase()) {
  console.error(
    '⛔ CHURCHTOOLS_TEST_BASE_URL zeigt auf DIESELBE Instanz wie CHURCHTOOLS_BASE_URL.\n' +
      '  Abbruch – dieses Skript darf die Gemeinde-Instanz nicht anfassen.',
  );
  process.exit(1);
}

const PAUSE_MS = 500;

/** Ein Schreibversuch mit leerem Rumpf. Kann nichts anlegen – alle Pflichtfelder fehlen. */
async function leerVersuch(method: 'POST' | 'PUT', pfad: string, csrf: string): Promise<void> {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const res = await fetch(`${BASE}${pfad}`, {
    method,
    headers: {
      Authorization: `Login ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'CSRF-Token': csrf,
    },
    body: '{}',
  });
  if (res.status === 429) {
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    process.exit(1);
  }
  const text = await res.text();
  let deutung: string;
  if (res.status === 404) deutung = 'GIBT ES NICHT';
  else if (res.status === 400 || res.status === 422) deutung = 'EXISTIERT (Validierungsfehler)';
  else if (res.status === 401 || res.status === 403) deutung = 'existiert, aber keine Berechtigung';
  else if (res.status >= 200 && res.status < 300)
    deutung = '⚠️ HAT ETWAS ANGELEGT – bitte in der Test-Instanz nachsehen und aufräumen!';
  else deutung = 'unklar';

  console.log(`\n  ${method} ${pfad}`);
  console.log(`    ${res.status} → ${deutung}`);
  // Der Fehlertext nennt bei 400 die Pflichtfelder – genau das wollen wir wissen.
  console.log(`    ${text.slice(0, 500).replace(/\s+/g, ' ')}`);
}

async function main(): Promise<void> {
  console.log(`\nChurchTools-Erkundung „Lieder anlegen"\nTest-Instanz: ${BASE}`);
  console.log('Leerer Rumpf – kann nichts anlegen, zeigt aber, ob es den Endpunkt gibt.\n');

  // CSRF-Token holen (Schreibvorgänge brauchen es – wie im Server-Code).
  const csrfRes = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (!csrfRes.ok) {
    console.error(`✗ CSRF-Token nicht erhalten (HTTP ${csrfRes.status}) – Abbruch.`);
    process.exit(1);
  }
  const csrf = ((await csrfRes.json()) as { data?: string }).data ?? '';

  await leerVersuch('POST', '/api/songs', csrf);
  await leerVersuch('POST', '/api/songs/1/arrangements', csrf);
  await leerVersuch('PUT', '/api/songs/1', csrf);

  console.log('\nFertig.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ Abbruch:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
