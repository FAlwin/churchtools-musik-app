/**
 * Erkundung: Bietet **ChurchTools selbst** eine SongSelect-Anbindung über die API an?
 *
 * **Warum die Frage neu gestellt wird.** Bisher stand in #322: „SongSelect-Import nicht machbar –
 * CCLI gibt die Datenbank nur zertifizierten Partnern frei." Das ist richtig, beantwortet aber eine
 * ANDERE Frage: Es sagt, dass *wir* nicht direkt bei CCLI anfragen dürfen. Alwins Idee ist eine
 * andere – die App als **Fernbedienung für ChurchTools**: ChurchTools ist der zertifizierte Partner,
 * die Gemeinde hat die CCLI-Lizenz, und unsere App löst nur die Funktion aus, die in der
 * ChurchTools-Oberfläche ohnehin vorhanden ist. Dafür brauchen wir keinen eigenen CCLI-Zugang –
 * wohl aber einen Endpunkt, den ChurchTools uns anbietet.
 *
 * Diese Unterscheidung war in meiner früheren Aussage nicht gemacht. Deshalb wird hier gemessen
 * statt geschlossen.
 *
 * Aufruf:  npx tsx server/scripts/probe-songselect.ts
 *
 * **STRENG LESEND.** Ausschließlich GET-Anfragen; nichts wird angelegt, geändert oder gelöscht.
 * Suchbegriffe gehen an ChurchTools, nicht an CCLI. Der Token wird nie ausgegeben.
 *
 * Bei HTTP 429 bricht das Skript SOFORT ab – unsere eigene App hat ChurchTools schon einmal
 * überfahren (#300), danach scheiterten Login, Rechte und Speichern gleichzeitig.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

const PAUSE_MS = 400;
const schlafe = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Antwort {
  status: number;
  text: string;
}

async function hole(pfad: string): Promise<Antwort> {
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    console.error('\n✗ HTTP 429 – ChurchTools drosselt. ABBRUCH (siehe #300).');
    process.exit(2);
  }
  return { status: res.status, text: (await res.text()).slice(0, 4000) };
}

/** Kurzform für die Ausgabe: Statuscode + ein Hinweis, was dahinter steckt. */
function deutung(a: Antwort): string {
  if (a.status === 404) return '404 – gibt es nicht';
  if (a.status === 401 || a.status === 403) return `${a.status} – existiert, aber kein Recht`;
  if (a.status === 400 || a.status === 422) return `${a.status} – EXISTIERT (Pflichtfelder fehlen)`;
  if (a.status === 200) return '200 – EXISTIERT und antwortet';
  return String(a.status);
}

async function main(): Promise<void> {
  console.log(`\nChurchTools: ${BASE}\n`);

  // ── 1. Version, damit die Aussage datierbar bleibt ────────────────────────────────
  const info = await hole('/api/info');
  const version = (() => {
    try {
      return (JSON.parse(info.text) as { build?: string; version?: string }).version ?? '?';
    } catch {
      return '?';
    }
  })();
  console.log(`ChurchTools-Version: ${version}\n`);
  await schlafe(PAUSE_MS);

  /**
   * ── 2. Die API-Beschreibung ist die verlässlichste Auskunft ──────────────────────
   * Geratene Pfade beweisen bei 404 wenig (vielleicht heißt es nur anders). Steht eine
   * OpenAPI-Beschreibung zur Verfügung, sagt sie vollständig, was es gibt.
   */
  console.log('── API-Beschreibung suchen ───────────────────────────');
  const specPfade = ['/api/openapi', '/api/openapi.json', '/api/swagger.json', '/api/doc'];
  let spec = '';
  for (const p of specPfade) {
    const a = await hole(p);
    console.log(`  ${p.padEnd(24)} ${deutung(a)}`);
    if (a.status === 200 && a.text.length > 500) spec = a.text;
    await schlafe(PAUSE_MS);
  }

  if (spec) {
    // Die Beschreibung wird nur DURCHSUCHT, nichts daraus ausgeführt.
    for (const wort of ['songselect', 'ccli', 'import']) {
      const treffer = spec.toLowerCase().split(wort).length - 1;
      console.log(`  Beschreibung enthält „${wort}": ${treffer}×`);
    }
  } else {
    console.log('  (keine maschinenlesbare Beschreibung erreichbar – weiter mit Stichproben)');
  }

  /**
   * ── 3. Stichproben auf naheliegende Pfade ───────────────────────────────────────
   * Ein 404 ist hier KEIN Beweis, dass es die Funktion nicht gibt – nur, dass sie nicht so heißt.
   * Ein 400/403 dagegen ist ein starker Hinweis, dass der Endpunkt existiert.
   */
  console.log('\n── Stichproben ───────────────────────────────────────');
  const kandidaten = [
    '/api/songselect/search?query=test',
    '/api/ccli/songselect/search?query=test',
    '/api/songs/songselect/search?query=test',
    '/api/songs/import',
    '/api/ccli',
    '/api/ccli/reporting',
    '/api/songcategories',
  ];
  for (const p of kandidaten) {
    const a = await hole(p);
    console.log(`  ${p.padEnd(42)} ${deutung(a)}`);
    await schlafe(PAUSE_MS);
  }

  /**
   * ── 4. Die Rechte des Kontos ────────────────────────────────────────────────────
   * Sie zählen die Module und Rechte auf, die diese Instanz überhaupt kennt. Taucht dort etwas mit
   * CCLI/SongSelect auf, gibt es die Funktion – dann ist nur noch die Frage, unter welchem Pfad.
   */
  console.log('\n── Rechte: Hinweise auf CCLI/SongSelect ──────────────');
  const rechte = await hole('/api/permissions/global');
  const treffer = [...rechte.text.matchAll(/"([^"]*(?:ccli|songselect|song)[^"]*)"/gi)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i);
  console.log(treffer.length ? `  ${treffer.join('\n  ')}` : '  (keine Treffer)');

  console.log('\nFertig. Nichts wurde verändert.\n');
}

void main();
