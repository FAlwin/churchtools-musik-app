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

/** Ein echter Aufruf mit Rumpf – nur im Durchgang hinter `--ja-ich-will`. */
async function schreibVersuch(
  method: 'POST' | 'PUT' | 'DELETE',
  pfad: string,
  csrf: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const res = await fetch(`${BASE}${pfad}`, {
    method,
    headers: {
      Authorization: `Login ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'CSRF-Token': csrf,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

/**
 * **Der Durchgang, der wirklich anlegt** (#322, Schritt 10) – nur mit `--ja-ich-will`.
 *
 * Die Leer-Versuche oben beantworten „gibt es den Endpunkt?". Sie beantworten **nicht** die Frage,
 * an der die Umsetzung hängt: **Liefert ChurchTools die ID des neuen Liedes zurück?** Ohne sie
 * könnte die App das gerade angelegte Lied nicht öffnen, kein Arrangement daranhängen und kein
 * Notenblatt holen – sie müsste die ganze Liste neu lesen und über den Namen raten.
 *
 * Das ist keine Frage, die sich lesend klären lässt. Deshalb legt dieser Durchgang ein Lied an,
 * zeigt die Antwortform und **räumt danach auf**. Er läuft nur gegen die Test-Instanz (zwei Sperren
 * oben) und nur auf ausdrückliche Ansage.
 *
 * **Das Aufräumen wird geprüft, nicht geglaubt** – dieselbe Lehre wie am 11.08.2026, als ein
 * `status: success` ein Notenblatt gekostet hat: Am Ende wird nachgesehen, ob das Lied wirklich weg
 * ist. Bleibt es liegen, sagt das Skript das deutlich, statt „fertig" zu melden.
 */
async function anlegeDurchgang(csrf: string): Promise<void> {
  console.log('\n── Echter Anlege-Durchgang (Test-Instanz) ──');
  const name = `ZZZ Test (App-Erkundung ${new Date().toISOString().slice(0, 16)})`;

  /**
   * **Alle Felder auf einmal mitschicken – die zweite Frage dieses Durchgangs.**
   *
   * Nimmt `POST /api/songs` Autor, CCLI-Nummer und Copyright direkt an, ist das Anlegen EIN
   * Schreibvorgang. Ignoriert es sie, braucht es hinterher ein `PUT` – also einen weiteren Schritt,
   * der eigenständig scheitern kann. Das ist kein Detail: Jeder zusätzliche Schreibvorgang ist ein
   * weiterer Zwischenzustand, den die App benennen muss.
   */
  const angelegt = await schreibVersuch('POST', '/api/songs', csrf, {
    name,
    categoryId: 0,
    author: 'Test Autor',
    ccli: '1234567',
    copyright: 'Test Copyright',
    note: 'Test Notiz',
  });
  console.log(`  POST /api/songs → ${angelegt.status}`);
  console.log(`    Antwort: ${JSON.stringify(angelegt.json).slice(0, 700)}`);
  const gesetzt = (angelegt.json as { data?: Record<string, unknown> } | null)?.data ?? {};
  for (const feld of ['author', 'ccli', 'copyright', 'note']) {
    console.log(
      `    ${gesetzt[feld] ? '✓' : '✗'} ${feld} beim Anlegen ${gesetzt[feld] ? 'übernommen' : 'IGNORIERT (braucht ein PUT hinterher)'}`,
    );
  }

  const daten = (angelegt.json as { data?: { id?: number } } | null)?.data;
  const songId = typeof daten?.id === 'number' ? daten.id : null;
  console.log(
    songId === null
      ? '    ⚠️  KEINE ID in der Antwort – die App müsste das neue Lied anders wiederfinden.'
      : `    ✓ ID kommt mit: ${songId}`,
  );
  if (songId === null) return;

  /**
   * **Wird das erste Arrangement zum Standard?** Im ersten Versuch kam `isDefault: false` zurück –
   * das Lied hätte also gar kein Standard-Arrangement. Für die App ist das erheblich:
   * `getSongLibrary` nimmt `find(isDefault) ?? arrangements[0]`, arbeitet also notfalls mit dem
   * ersten; wer sich aber auf `isDefault` verlässt, steht vor `undefined`. Hier wird geprüft, ob
   * ChurchTools das Flag beim Anlegen annimmt.
   */
  const arr = await schreibVersuch('POST', `/api/songs/${songId}/arrangements`, csrf, {
    name: 'Standard',
    isDefault: true,
    key: 'E',
  });
  console.log(`  POST /api/songs/${songId}/arrangements → ${arr.status}`);
  console.log(`    Antwort: ${JSON.stringify(arr.json).slice(0, 500)}`);
  const arrDaten = (arr.json as { data?: Record<string, unknown> } | null)?.data ?? {};
  console.log(
    `    ${arrDaten.isDefault ? '✓' : '✗'} isDefault ${arrDaten.isDefault ? 'übernommen' : 'IGNORIERT – das Lied hat dann kein Standard-Arrangement'}`,
  );
  console.log(
    `    ${arrDaten.key ? '✓' : '✗'} key ${arrDaten.key ? `übernommen (${String(arrDaten.key)})` : 'IGNORIERT'}`,
  );

  // Welche Stammdaten-Felder nimmt ChurchTools an? Danach richtet sich, was das Formular mitschickt.
  const nachher = await schreibVersuch('PUT', `/api/songs/${songId}`, csrf, {
    name,
    categoryId: 0,
    author: 'Test Autor',
    ccli: '1234567',
    copyright: 'Test Copyright',
    note: 'Notiz',
  });
  console.log(`  PUT /api/songs/${songId} (Stammdaten) → ${nachher.status}`);
  console.log(`    Antwort: ${JSON.stringify(nachher.json).slice(0, 500)}`);

  // Aufräumen – und danach NACHSEHEN, ob es wirklich weg ist.
  const geloescht = await schreibVersuch('DELETE', `/api/songs/${songId}`, csrf);
  console.log(`  DELETE /api/songs/${songId} → ${geloescht.status}`);
  const kontrolle = await fetch(`${BASE}/api/songs/${songId}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  console.log(
    kontrolle.status === 404
      ? '    ✓ Aufgeräumt (Kontrolle: 404).'
      : `    ⚠️  Lied #${songId} liegt NOCH in der Test-Instanz (Kontrolle: ${kontrolle.status}) – bitte von Hand löschen.`,
  );
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

  if (process.argv.includes('--ja-ich-will')) {
    await anlegeDurchgang(csrf);
  } else {
    console.log(
      '\nHinweis: Der Durchgang, der wirklich ein Lied anlegt (und danach aufräumt), läuft nur mit\n' +
        '  npx tsx server/scripts/probe-songwrite.ts --ja-ich-will\n' +
        'Er beantwortet, ob ChurchTools die ID des neuen Liedes zurückgibt – lesend nicht klärbar.',
    );
  }

  console.log('\nFertig.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ Abbruch:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
