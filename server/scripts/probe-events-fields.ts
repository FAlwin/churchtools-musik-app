/**
 * Erkundung für #300 Folgeschritt: **Verrät ChurchTools uns von sich aus, welche Termine
 * überhaupt einen Ablaufplan haben?**
 *
 * ── WARUM ────────────────────────────────────────────────────────────────────────────────────────
 * Der Statistik-Lauf (`getSongUsageMap`) fragt für JEDEN Termin der letzten 4 Jahre den Ablaufplan ab.
 * Der erste Betriebslauf zeigte: 223 Termine, davon nur **48 mit Ablauf** – **175 Anfragen (78 %) für
 * nichts**. Genau dieser Massenlauf hat ChurchTools zu HTTP 429 gebracht.
 *
 * Bevor wir uns einen eigenen Merker bauen (der still falsch werden kann, sobald ein Termin
 * nachträglich einen Ablauf bekommt), muss diese Frage beantwortet sein:
 * **Steht die Antwort schon in der Termin-Liste, die wir ohnehin holen?**
 *
 * ── WAS DIE SPEZIFIKATION SCHON SAGT (openapi.json der Instanz, geprüft 06.08.2026) ──────────────
 * Laut `GET /events` gibt es KEIN Feld, das auf einen Ablauf hinweist, und `include` kennt laut
 * Beschreibung nur `eventServices`. **Aber eine Spezifikation ist kein Beweis über die echte Antwort** –
 * sie darf unvollständig sein. Dieses Skript prüft die Wirklichkeit nach.
 *
 * ── SICHERUNGEN ──────────────────────────────────────────────────────────────────────────────────
 *   1. **Nur lesende Anfragen.** Es wird nichts angelegt, geändert oder gelöscht.
 *   2. Standardlauf = **3 Anfragen**. Das ist weniger als ein einziger Seitenaufruf der App.
 *   3. Der Zusatzlauf `--kalender` kostet so viel wie EIN normaler Statistik-Lauf (~224 Anfragen) und
 *      muss ausdrücklich angefordert werden. Er stoppt beim ersten 429.
 *   4. Das Token wird nie ausgegeben.
 *
 * ── AUFRUF ───────────────────────────────────────────────────────────────────────────────────────
 *   Feldfragen klären (billig, empfohlen):
 *     npx tsx server/scripts/probe-events-fields.ts
 *   Zusätzlich messen, ob der Kalender ein verlässliches Kriterium wäre (teuer):
 *     npx tsx server/scripts/probe-events-fields.ts --kalender
 *
 * Liest `CHURCHTOOLS_BASE_URL` + `CHURCHTOOLS_LOGIN_TOKEN` aus der `.env`.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const MIT_KALENDER = process.argv.includes('--kalender');

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

const USAGE_LOOKBACK_YEARS = 4;

interface CtAntwort<T> {
  data?: T;
  meta?: unknown;
}

let anfragen = 0;

async function ct<T>(pfad: string): Promise<{ status: number; body: CtAntwort<T> }> {
  anfragen++;
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  let body: CtAntwort<T> = {};
  try {
    body = (await res.json()) as CtAntwort<T>;
  } catch {
    /* leerer/kein JSON-Rumpf – Status genügt */
  }
  return { status: res.status, body };
}

/**
 * Union ALLER Schlüssel über ALLE Termine – nicht nur die des ersten.
 * Wichtig: Ein Hinweis-Feld könnte nur bei Terminen MIT Ablauf auftauchen. Wer nur `data[0]`
 * ansieht, übersieht genau das.
 */
function feldUnion(rows: Record<string, unknown>[]): Set<string> {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return keys;
}

function fenster(): { from: string; to: string } {
  const heute = new Date();
  const to = heute.toISOString().slice(0, 10);
  const vor = new Date(heute);
  vor.setFullYear(vor.getFullYear() - USAGE_LOOKBACK_YEARS);
  return { from: vor.toISOString().slice(0, 10), to };
}

type Termin = Record<string, unknown>;

async function termine(zusatz = ''): Promise<{ rows: Termin[]; meta: unknown; status: number }> {
  const { from, to } = fenster();
  const { status, body } = await ct<Termin[]>(`/api/events?from=${from}&to=${to}${zusatz}`);
  return { rows: body.data ?? [], meta: body.meta, status };
}

async function main(): Promise<void> {
  const { from, to } = fenster();
  console.log('Erkundung: Verrät ChurchTools die Termine MIT Ablaufplan? (#300)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Instanz: ${BASE}`);
  console.log(`Fenster: ${from} … ${to}`);
  console.log('Nur LESENDE Abrufe.\n');

  // ── 1) Die Termin-Liste, so wie die App sie ohnehin holt ───────────────────────────────────────
  const basis = await termine();
  if (basis.status !== 200) {
    console.error(`✗ /api/events antwortete HTTP ${basis.status}. Abbruch.`);
    process.exit(1);
  }
  console.log(`✓ ${basis.rows.length} Termine im Fenster.`);
  console.log(`  meta: ${basis.meta ? JSON.stringify(basis.meta) : '(keine)'}`);
  console.log(
    `  → Bei ${basis.rows.length} Zeilen trotz Standard-limit=10 ist belegt: mit from+to ignoriert\n` +
      `    ChurchTools limit/page. Es gibt also KEINE stille Kürzung der Liste.`,
  );

  const felder = feldUnion(basis.rows);
  console.log(`\n=== Alle Felder über ALLE ${basis.rows.length} Termine (Union) ===`);
  console.log('  ' + [...felder].sort().join(', '));

  // Nutzt unser Typ etwas nicht, das nach „hat Ablauf" klingt?
  const verdaechtig = [...felder].filter((k) =>
    /agenda|setlist|ablauf|song|program|schedule/i.test(k),
  );
  console.log(
    `\n>>> FRAGE 1 – Gibt es ein Feld, das auf einen Ablauf hinweist?\n` +
      `    ${verdaechtig.length ? `JA, verdächtig: ${verdaechtig.join(', ')}` : 'NEIN – kein einziges Feld deutet darauf hin.'}`,
  );

  console.log('\n=== Ein vollständiger Termin, roh ===');
  console.log(JSON.stringify(basis.rows[0], null, 2).slice(0, 2000));

  // ── 2) Versteht ChurchTools ?include=agenda? ───────────────────────────────────────────────────
  // Gegenprobe eingebaut: `include=eventServices` ist dokumentiert und MUSS wirken. Wirkt es nicht,
  // ist ein wirkungsloses `include=agenda` kein Beweis – dann stimmt etwas mit dem Aufruf nicht.
  const mitAgenda = await termine('&include=agenda');
  const mitServices = await termine('&include=eventServices');
  const fAgenda = feldUnion(mitAgenda.rows);
  const fServices = feldUnion(mitServices.rows);

  const neuDurchAgenda = [...fAgenda].filter((k) => !felder.has(k));
  const neuDurchServices = [...fServices].filter((k) => !felder.has(k));

  console.log('\n=== include-Probe ===');
  console.log(
    `  include=agenda        → HTTP ${mitAgenda.status}, neue Felder: ` +
      `${neuDurchAgenda.length ? neuDurchAgenda.join(', ') : '(keine)'}`,
  );
  console.log(
    `  include=eventServices → HTTP ${mitServices.status}, neue Felder: ` +
      `${neuDurchServices.length ? neuDurchServices.join(', ') : '(keine)'}   [Gegenprobe]`,
  );

  if (neuDurchServices.length === 0) {
    console.log(
      '\n  ⚠ Die Gegenprobe wirkt NICHT. Das dokumentierte include=eventServices hätte ein Feld\n' +
        '    ergänzen müssen. Solange das so ist, beweist ein wirkungsloses include=agenda nichts.',
    );
  } else {
    console.log(
      `\n>>> FRAGE 2 – Liefert include=agenda den Ablauf mit?\n` +
        `    ${neuDurchAgenda.length ? 'JA – siehe neue Felder oben.' : 'NEIN. Die Gegenprobe wirkt, include=agenda aber nicht.'}`,
    );
  }

  // ── 3) Kalender-Verteilung (kostenlos aus der schon geholten Liste) ────────────────────────────
  const proKalender = new Map<string, number>();
  for (const r of basis.rows) {
    const cal = r.calendar as { domainIdentifier?: string; title?: string } | undefined;
    const key = `${cal?.domainIdentifier ?? '?'} – ${cal?.title ?? '(ohne Titel)'}`;
    proKalender.set(key, (proKalender.get(key) ?? 0) + 1);
  }
  console.log('\n=== Termine je Kalender (aus derselben einen Anfrage) ===');
  for (const [k, n] of [...proKalender].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }

  if (!MIT_KALENDER) {
    console.log(
      `\n(Ob der Kalender ein VERLÄSSLICHES Kriterium ist, misst erst --kalender.\n` +
        ` Das kostet ~${basis.rows.length} Anfragen, also so viel wie ein normaler Statistik-Lauf.)`,
    );
    console.log(`\n✓ Fertig nach ${anfragen} Anfragen.`);
    return;
  }

  // ── 4) Kreuztabelle Kalender × hat Ablauf ──────────────────────────────────────────────────────
  console.log(`\n── Messung: welcher Kalender hat Abläufe? (~${basis.rows.length} Anfragen) ──`);
  const tabelle = new Map<string, { mit: number; ohne: number; fehler: number }>();
  let gedrosselt = false;

  for (const r of basis.rows) {
    if (gedrosselt) break;
    const cal = r.calendar as { domainIdentifier?: string; title?: string } | undefined;
    const key = `${cal?.domainIdentifier ?? '?'} – ${cal?.title ?? '(ohne Titel)'}`;
    const zeile = tabelle.get(key) ?? { mit: 0, ohne: 0, fehler: 0 };
    const { status } = await ct(`/api/events/${String(r.id)}/agenda`);
    if (status === 429) {
      console.log('\n⚠ HTTP 429 – ChurchTools drosselt. Messung hier beendet.');
      gedrosselt = true;
    } else if (status === 200) zeile.mit++;
    else if (status === 404) zeile.ohne++;
    else zeile.fehler++;
    tabelle.set(key, zeile);
  }

  console.log('\n=== Kalender × Ablaufplan ===');
  console.log('   mit   ohne  Fehler  Kalender');
  for (const [k, v] of [...tabelle].sort((a, b) => b[1].mit - a[1].mit)) {
    console.log(
      `  ${String(v.mit).padStart(4)}  ${String(v.ohne).padStart(5)}  ${String(v.fehler).padStart(6)}  ${k}`,
    );
  }

  const gemischt = [...tabelle].filter(([, v]) => v.mit > 0 && v.ohne > 0);
  console.log(
    `\n>>> FRAGE 3 – Trennt der Kalender sauber?\n` +
      (gemischt.length === 0
        ? '    JA – jeder Kalender hat entweder nur Termine MIT oder nur OHNE Ablauf.\n' +
          '    Achtung: gilt für DIESE Gemeinde und DIESES Fenster. Kein Naturgesetz.'
        : `    NEIN – ${gemischt.length} Kalender enthalten beides:\n` +
          gemischt.map(([k, v]) => `      ${k}: ${v.mit} mit / ${v.ohne} ohne`).join('\n')),
  );

  console.log(`\n✓ Fertig nach ${anfragen} Anfragen.`);
}

main().catch((e: unknown) => {
  console.error(`\n✗ Fehler: ${(e as Error).message}`);
  process.exit(1);
});
