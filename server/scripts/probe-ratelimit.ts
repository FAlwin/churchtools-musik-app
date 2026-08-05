/**
 * Misst das Rate-Limit der eigenen ChurchTools-Instanz (#300).
 *
 * ── WAS DAS IST UND WAS NICHT ────────────────────────────────────────────────────────────────────
 * Das ist **kein Penetrationstest** und kein Angriff. Es ist eine Messung an der **eigenen** Instanz
 * der Gemeinde, um eine Zahl zu erfahren, die wir sonst raten müssten: ab wann bremst ChurchTools uns
 * aus, und wie lange?
 *
 * ── WARUM ────────────────────────────────────────────────────────────────────────────────────────
 * Im Betrieb kam HTTP 429 („zu viele Anfragen"), nachdem die Lied-Statistik ~250 Abrufe in einem Zug
 * gemacht hatte. Danach bekam ALLES andere 429 – Anmeldung, Rechte, Speichern. Behoben ist die
 * Ursache (#300), aber die eigentliche Grenze kennen wir nicht. Und das entscheidet, was als Nächstes
 * richtig ist:
 *   - Ist es eine **Rate** (z. B. 60/min), hilft eine Drossel.
 *   - Ist es ein **Kontingent** (z. B. 5.000/Stunde), hilft eine Drossel NICHT – dann muss die
 *     Gesamtzahl der Anfragen runter.
 * Ohne diese Antwort wäre jede eingebaute Zahl geraten.
 *
 * ── SICHERUNGEN (bewusst eingebaut) ──────────────────────────────────────────────────────────────
 *   1. **Nur lesende Anfragen.** Es wird nichts angelegt, geändert oder gelöscht.
 *   2. **Stopp beim ERSTEN 429.** Es wird bis an die Grenze gemessen, nie darüber.
 *   3. **Sanfter Anlauf** mit kleinen Stufen und Pausen dazwischen.
 *   4. **Harte Obergrenze** an Anfragen (`MAX_REQUESTS`) – selbst wenn nie ein 429 kommt.
 *   5. **Muss ausdrücklich bestätigt werden** (`--ja-ich-will`), sonst läuft nur ein Trockenlauf,
 *      der bloß erklärt, was passieren würde.
 *   6. Das Token wird **nie** ausgegeben.
 *
 * ── WANN ─────────────────────────────────────────────────────────────────────────────────────────
 * An einem **Wochentagabend**. NICHT Samstag/Sonntag, nicht während einer Probe oder kurz vor dem
 * Gottesdienst: Während der Messung kann ChurchTools für andere kurz langsamer sein.
 *
 * ── AUFRUF ───────────────────────────────────────────────────────────────────────────────────────
 *   Trockenlauf (harmlos, empfohlen zuerst):
 *     npx tsx server/scripts/probe-ratelimit.ts
 *   Echte Messung:
 *     npx tsx server/scripts/probe-ratelimit.ts --ja-ich-will
 *
 * Liest `CHURCHTOOLS_BASE_URL` + `CHURCHTOOLS_LOGIN_TOKEN` aus der `.env`.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const ECHT = process.argv.includes('--ja-ich-will');

/** Harte Obergrenze: Selbst ohne 429 hört die Messung hier auf. */
const MAX_REQUESTS = 400;
/** Nebenläufigkeits-Stufen. Bewusst sanft beginnend. */
const STUFEN = [1, 2, 4, 8, 12, 16];
/** Anfragen je Stufe. */
const PRO_STUFE = 20;
/** Pause zwischen den Stufen – gibt einem Zeitfenster-Limit Gelegenheit, sich zu zeigen. */
const PAUSE_MS = 2000;
/** Wie lange nach einem 429 auf die Erholung gewartet wird. */
const ERHOLUNG_MAX_MS = 10 * 60 * 1000;
const ERHOLUNG_TAKT_MS = 5000;

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

const schlaf = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Alle Kopfzeilen, die etwas über ein Limit verraten könnten. */
const INTERESSANTE_KOEPFE = [
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'server',
  'via',
  'cf-ray',
  'x-powered-by',
];

function koepfeVon(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of INTERESSANTE_KOEPFE) {
    const v = res.headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

let cookie = '';
let gesamt = 0;

/** Anmelden – einmalig, damit die Messung mit einer echten Sitzung läuft. */
async function anmelden(): Promise<void> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`✗ Anmeldung fehlgeschlagen: HTTP ${res.status}`);
    process.exit(1);
  }
  const setCookie =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''];
  for (const c of setCookie) {
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) cookie = m[1];
  }
  if (!cookie) {
    console.error('✗ Keine Sitzung von ChurchTools erhalten.');
    process.exit(1);
  }
  console.log('✓ angemeldet (Token wird nicht ausgegeben)\n');
}

/** Ein einzelner, harmloser Lese-Abruf. */
async function lesen(pfad: string): Promise<Response> {
  gesamt++;
  return fetch(`${BASE}${pfad}`, { headers: { Cookie: cookie, Accept: 'application/json' } });
}

/** Erholungszeit messen: Ab wann antwortet ChurchTools wieder normal? */
async function erholungMessen(): Promise<void> {
  console.log('\n── Erholung ─────────────────────────────────────────');
  console.log('Frage alle 5 s einen einzelnen billigen Endpunkt ab, bis wieder 200 kommt.');
  const start = Date.now();
  for (;;) {
    await schlaf(ERHOLUNG_TAKT_MS);
    const verstrichen = Date.now() - start;
    if (verstrichen > ERHOLUNG_MAX_MS) {
      console.log(
        `⚠ Nach ${Math.round(verstrichen / 1000)} s immer noch gedrosselt – abgebrochen.`,
      );
      return;
    }
    const res = await lesen('/api/whoami');
    process.stdout.write(`  ${Math.round(verstrichen / 1000)}s → HTTP ${res.status}\n`);
    if (res.ok) {
      console.log(`\n✓ Wieder frei nach ~${Math.round(verstrichen / 1000)} Sekunden.`);
      console.log(
        '  → Kurz (Sekunden bis ~1 min): eher eine RATE pro Zeitfenster. Eine Drossel hilft.\n' +
          '  → Lang (viele Minuten/Stunde): eher ein KONTINGENT. Dann muss die GESAMTZAHL runter,\n' +
          '    eine Drossel würde den Ausfall nur verschieben.',
      );
      return;
    }
  }
}

async function main(): Promise<void> {
  console.log('ChurchTools Rate-Limit-Messung (#300)');
  console.log('─────────────────────────────────────');
  console.log(`Instanz: ${BASE}`);
  console.log(`Stufen: ${STUFEN.join(', ')} gleichzeitig · je ${PRO_STUFE} Anfragen`);
  console.log(`Obergrenze: ${MAX_REQUESTS} Anfragen · Stopp beim ERSTEN 429`);
  console.log('Nur LESENDE Abrufe – es wird nichts geändert.\n');

  if (!ECHT) {
    console.log('TROCKENLAUF – es wird nichts an ChurchTools geschickt.');
    console.log('Für die echte Messung:  npx tsx server/scripts/probe-ratelimit.ts --ja-ich-will');
    console.log(
      '\nBitte an einem WOCHENTAGABEND ausführen, nicht Sa/So und nicht vor einer Probe.',
    );
    return;
  }

  await anmelden();

  // Ein paar echte Termin-IDs holen, damit die Abrufe realistisch sind (wie der Statistik-Lauf).
  const heute = new Date().toISOString().slice(0, 10);
  const vor4 = new Date();
  vor4.setFullYear(vor4.getFullYear() - 4);
  const evRes = await lesen(`/api/events?from=${vor4.toISOString().slice(0, 10)}&to=${heute}`);
  if (!evRes.ok) {
    console.error(`✗ Termine konnten nicht geladen werden: HTTP ${evRes.status}`);
    return;
  }
  const evJson = (await evRes.json()) as { data?: { id: number }[]; meta?: unknown };
  const ids = (evJson.data ?? []).map((e) => e.id);
  console.log(`✓ ${ids.length} Termine im 4-Jahres-Fenster.`);
  // Wichtig für #300 Schritt 5: Liefert ChurchTools hier Paginierungsinfos? Ohne diese Antwort darf
  // später kein Aufräum-Schritt gebaut werden, der „nicht mehr vorhandene" Termine löscht.
  console.log(
    `  meta: ${evJson.meta ? JSON.stringify(evJson.meta) : '(keine – KEINE Paginierung erkennbar)'}\n`,
  );
  if (ids.length === 0) return;

  console.log('── Messung ──────────────────────────────────────────');
  for (const stufe of STUFEN) {
    if (gesamt >= MAX_REQUESTS) {
      console.log(`\n⚠ Obergrenze von ${MAX_REQUESTS} Anfragen erreicht – Messung beendet.`);
      console.log('  Kein 429 aufgetreten: Das Limit liegt über dem, was hier geprüft wurde.');
      return;
    }
    const start = Date.now();
    let gedrosselt: Response | null = null;

    for (let i = 0; i < PRO_STUFE && !gedrosselt; i += stufe) {
      const antworten = await Promise.all(
        Array.from({ length: Math.min(stufe, PRO_STUFE - i) }, (_, k) =>
          lesen(`/api/events/${ids[(i + k) % ids.length]}/agenda`),
        ),
      );
      gedrosselt = antworten.find((r) => r.status === 429) ?? null;
    }

    const dauer = (Date.now() - start) / 1000;
    const rate = (PRO_STUFE / dauer).toFixed(1);
    console.log(
      `  ${String(stufe).padStart(2)} gleichzeitig → ${PRO_STUFE} Anfragen in ${dauer.toFixed(1)} s ` +
        `(~${rate}/s, gesamt ${gesamt})${gedrosselt ? '  ← 429!' : ''}`,
    );

    if (gedrosselt) {
      console.log('\n── Das Limit ist erreicht ───────────────────────────');
      console.log(`Nach insgesamt ${gesamt} Anfragen.`);
      console.log('Antwort-Kopfzeilen:');
      const koepfe = koepfeVon(gedrosselt);
      if (Object.keys(koepfe).length === 0) {
        console.log('  (keine aussagekräftigen Kopfzeilen – ChurchTools verrät sein Limit nicht)');
      } else {
        for (const [k, v] of Object.entries(koepfe)) console.log(`  ${k}: ${v}`);
      }
      const rumpf = await gedrosselt.text().catch(() => '');
      console.log(`Antwort-Text: ${rumpf.slice(0, 300) || '(leer)'}`);
      console.log(
        '\nHinweis: Stehen dort `server`/`via`/`cf-ray`, kommt der 429 womöglich von einem\n' +
          'Vorschalt-Dienst und nicht von ChurchTools selbst.',
      );
      await erholungMessen();
      return;
    }

    await schlaf(PAUSE_MS);
  }

  console.log(`\n✓ Kein 429 bei bis zu ${STUFEN[STUFEN.length - 1]} gleichzeitigen Anfragen.`);
  console.log(`  Insgesamt ${gesamt} Anfragen. Das Limit liegt darüber.`);
}

void main();
