/**
 * Erkundung, Teil 2 zu #396: Kann die **alte churchservice-Schnittstelle**, was die REST-API nicht
 * kann – Quelle/Liednummer am Arrangement und „zum Standard machen"?
 *
 * `probe-arrangements.ts` hat gemessen: Über `/api/songs/:id/arrangements` gehen Name, Tonart, Tempo,
 * Takt, Länge, Beschreibung – aber `isDefault` wird ignoriert und `source*` verworfen. Der
 * ChurchTools-Dialog kann beides, also muss es einen Weg geben. Verdacht: die alte Schnittstelle
 * (`index.php?q=churchservice/ajax`), aus der die App schon Kategorien und Abwesenheitsgründe holt.
 *
 * Aufruf (lesend):            npx tsx server/scripts/probe-arrangements-alt.ts
 * Aufruf mit Schreibdurchgang: npx tsx server/scripts/probe-arrangements-alt.ts --ja-ich-will
 *   (legt ein Testlied per REST an, probiert die alten Funktionen daran und räumt es wieder weg)
 *
 * **ZWEI SPERREN, damit das nie die Gemeinde trifft** – wie in `probe-arrangements.ts`:
 *  1. Der Zugang kommt aus `.env.churchtools-test`; fehlt sie, bricht das Skript ab.
 *  2. Zeigt sie auf dieselbe Instanz wie `CHURCHTOOLS_BASE_URL`, bricht es ebenfalls ab.
 *
 * Bei HTTP 429 (Drosselung) sofortiger Abbruch (#300). Der Token wird nie ausgegeben.
 * Jede Schreibprobe prüft den **Zustand danach per REST** – „status: success" gilt nicht als Beleg.
 *
 * ── ERGEBNIS des Laufs vom 20.09.2026 (Test-Instanz, ChurchTools 3.136.x) ─────────────────────
 *
 * **Alle drei gehen – aber nicht über die alte Schnittstelle, sondern per REST auf den Wegen, die
 * die ChurchTools-Oberfläche selbst nimmt.** Die Funktionsnamen der alten Welt (`editArrangement`,
 * `setDefaultArrangement`, …) gibt es NICHT („was not defined as Function"); das alte Modul
 * (`system/churchservice/models/cs_song.js`, `cs_songview.js`) ruft für Arrangements längst REST auf.
 * Dort abgelesen und hier nachgemessen:
 *
 *  1. **Zum Standard machen:** `PATCH /api/songs/:id/arrangements/:arrId/default` (ohne Body) →
 *     204, danach trägt genau dieses Arrangement `isDefault: true`. (Der erste Lauf hatte nur
 *     `POST …/default` und `PATCH` auf das Arrangement selbst probiert – beide 405.)
 *  2. **Quelle:** `PUT …/arrangements/:arrId { sourceId }` mit einer **gültigen ID aus
 *     `getMasterData` → `songsource`** (`{id, name, shorty, sortkey}`; ein `/api/`-Endpunkt dafür
 *     fehlt, wie bei Kategorien und Abwesenheitsgründen). Danach liefert die API
 *     `source: {id, name, shorty}` und `sourceId`. `sourceId: null` entfernt die Quelle wieder.
 *     Der erste Lauf hatte eine ungültige ID geschickt – die wird **stillschweigend** verworfen.
 *  3. **Liednummer:** `sourceReference` (Text, im Dialog max. 30 Zeichen) – wird **nur zusammen mit
 *     einer Quelle** gespeichert; ohne `sourceId` kommt 200 und `null` zurück. Der ChurchTools-Dialog
 *     lehnt „Nummer ohne Quelle" deshalb schon im Formular ab („song.source.missing").
 *
 * Nebenbefunde aus der Oberfläche: `sourceName` (deprecated) liefert das **Kürzel** (`shorty`), nicht
 * den Namen. Das alte Löschen verweigert sich, solange das Arrangement **Dateien** hat
 * („remove.files.first"). `POST /api/songs` ohne `arrangements` legt **kein** Standard-Arrangement
 * an – die Oberfläche schickt `arrangements: [{name, isDefault: true, key, beat, tempo}]` mit.
 */
import { config } from 'dotenv';

config();
config({ path: '.env.churchtools-test' });

const LIVE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const BASE = (process.env.CHURCHTOOLS_TEST_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_TEST_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error(
    '✗ Kein Test-Zugang gefunden.\n' +
      '  Dieses Skript läuft bewusst NUR gegen eine separate ChurchTools-Test-Instanz.\n' +
      '  Anlegen mit:  cp .env.churchtools-test.example .env.churchtools-test',
  );
  process.exit(1);
}
if (LIVE && BASE.toLowerCase() === LIVE.toLowerCase()) {
  console.error(
    '⛔ CHURCHTOOLS_TEST_BASE_URL zeigt auf DIESELBE Instanz wie CHURCHTOOLS_BASE_URL.\n' +
      '  Abbruch – dieses Skript darf die Gemeinde-Instanz nicht anfassen.',
  );
  process.exit(1);
}

const PAUSE_MS = 400;
const SCHREIBEN = process.argv.includes('--ja-ich-will');

interface Antwort {
  status: number;
  json: unknown;
}

let cookie = '';
let csrf = '';

async function pause(): Promise<void> {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

function bei429(status: number): void {
  if (status === 429) {
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    process.exit(1);
  }
}

/** REST-Aufruf mit Login-Token (nur zum Anlegen/Aufräumen/Gegenprüfen). */
async function rest(method: string, pfad: string, body?: unknown): Promise<Antwort> {
  await pause();
  const headers: Record<string, string> = {
    Authorization: `Login ${TOKEN}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${pfad}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  bei429(res.status);
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* Rohtext behalten */
  }
  return { status: res.status, json };
}

/** Aufruf der alten Schnittstelle – Rohantwort, NICHT ausgepackt, damit man Fehlertexte sieht. */
async function alt(func: string, felder: Record<string, string> = {}): Promise<Antwort> {
  await pause();
  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'CSRF-Token': csrf,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ func, ...felder }),
  });
  bei429(res.status);
  const text = await res.text();
  let json: unknown = text.slice(0, 300);
  try {
    json = JSON.parse(text);
  } catch {
    /* Rohtext (gekürzt) behalten */
  }
  return { status: res.status, json };
}

function kurz(v: unknown, n = 160): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function altDaten(a: Antwort): unknown {
  const j = a.json as { status?: string; data?: unknown; message?: string } | null;
  return j && typeof j === 'object' ? j.data : null;
}

function altStatus(a: Antwort): string {
  const j = a.json as { status?: string; message?: string } | null;
  if (!j || typeof j !== 'object') return `HTTP ${a.status} (kein JSON)`;
  return `HTTP ${a.status} status=${String(j.status)}${j.message ? ` „${String(j.message)}"` : ''}`;
}

async function anmelden(): Promise<void> {
  const who = await fetch(`${BASE}/api/whoami?login_token=${TOKEN}`, { redirect: 'manual' });
  cookie = (who.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) {
    console.error('✗ Kein Session-Cookie erhalten.');
    process.exit(1);
  }
  const csrfRes = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  const d = ((await csrfRes.json()) as { data?: unknown }).data;
  csrf = typeof d === 'string' ? d : '';
  console.log(`Anmeldung: Cookie ✓, CSRF-Token ${csrf ? '✓' : '– (Objekt statt Zeichenkette, weiter ohne)'}`);
}

/* ------------------------------------------------------------------ lesend */

async function masterData(): Promise<Record<string, unknown>> {
  console.log('\n── A: getMasterData – welche Tabellen gibt es? ──');
  const a = await alt('getMasterData');
  console.log(`  ${altStatus(a)}`);
  const d = altDaten(a);
  if (!d || typeof d !== 'object') return {};
  const obj = d as Record<string, unknown>;
  const keys = Object.keys(obj);
  console.log(`  Schlüssel (${keys.length}): ${keys.join(', ')}`);
  for (const k of keys) {
    if (/source|quelle|arrangement|song/i.test(k)) {
      console.log(`\n  ▸ ${k}: ${kurz(obj[k], 600)}`);
    }
  }
  return obj;
}

async function alleLieder(): Promise<void> {
  console.log('\n── B: getAllSongs – wie sieht ein Arrangement in der alten Welt aus? ──');
  const a = await alt('getAllSongs');
  console.log(`  ${altStatus(a)}`);
  const d = altDaten(a);
  if (!d || typeof d !== 'object') {
    console.log(`  data: ${kurz(d)}`);
    return;
  }
  const lieder = Object.values(d as Record<string, unknown>) as Array<Record<string, unknown>>;
  console.log(`  ${lieder.length} Lieder`);
  const mitArr = lieder.find((l) => l.arrangement && Object.keys(l.arrangement as object).length > 0);
  if (!mitArr) {
    console.log(`  Kein Lied mit Arrangement gefunden. Erstes Lied roh: ${kurz(lieder[0], 900)}`);
    return;
  }
  const liedFelder = Object.fromEntries(
    Object.entries(mitArr).filter(([k]) => k !== 'arrangement'),
  );
  console.log(`  Lied-Felder: ${kurz(liedFelder, 500)}`);
  const arr = Object.values(mitArr.arrangement as Record<string, unknown>)[0] as Record<
    string,
    unknown
  >;
  const arrFelder = Object.fromEntries(Object.entries(arr).filter(([k]) => k !== 'files'));
  console.log(`  Arrangement-Felder: ${kurz(arrFelder, 800)}`);
}

/* ------------------------------------------------------------------ Schreibdurchgang */

async function restArrangements(songId: number): Promise<Array<Record<string, unknown>>> {
  const a = await rest('GET', `/api/songs/${songId}`);
  const d = (a.json as { data?: { arrangements?: Array<Record<string, unknown>> } }).data;
  return d?.arrangements ?? [];
}

function zeigeArr(titel: string, arrs: Array<Record<string, unknown>>): void {
  console.log(`  ${titel}:`);
  for (const x of arrs) {
    const src = x.source as { name?: string } | null | undefined;
    console.log(
      `    #${String(x.id)} „${String(x.name)}" isDefault=${String(x.isDefault)} key=${String(x.key)} ` +
        `source=${src?.name ?? 'null'} sourceReference=${String(x.sourceReference ?? 'null')} ` +
        `sourceName=${String(x.sourceName ?? 'null')}`,
    );
  }
}

async function schreibDurchgang(master: Record<string, unknown>): Promise<void> {
  console.log('\n── Schreibdurchgang auf der Test-Instanz ──');
  const alle = await rest('GET', '/api/songs?limit=5');
  const liste = (alle.json as { data?: Array<Record<string, unknown>> }).data ?? [];
  // Kategorie-id 0 („Aktive Songs") ist gültig – deshalb `!== undefined`, nicht Wahrheitswert.
  const kat = (liste.find((s) => (s.category as { id?: number } | null)?.id !== undefined)
    ?.category ?? null) as { id: number } | null;
  if (!kat) {
    console.log('  ✗ Keine Kategorie gefunden – Abbruch.');
    return;
  }
  const name = `ZZ-Probe Alt ${new Date().toISOString().slice(11, 19)}`;
  const neu = await rest('POST', '/api/songs', { name, categoryId: kat.id });
  const songId = Number((neu.json as { data?: { id?: number } }).data?.id ?? 0);
  console.log(`  Lied anlegen (REST): HTTP ${neu.status}, songId ${songId || '—'}`);
  if (!songId) return;

  try {
    // Zweites Arrangement per REST, damit es etwas zum Umschalten gibt.
    const zweit = await rest('POST', `/api/songs/${songId}/arrangements`, {
      name: 'Zweites',
      key: 'G',
    });
    const zweitId = Number((zweit.json as { data?: { id?: number } }).data?.id ?? 0);
    console.log(`  Zweites Arrangement (REST): HTTP ${zweit.status}, id ${zweitId || '—'}`);
    const vorher = await restArrangements(songId);
    zeigeArr('Stand vorher', vorher);
    const std = vorher.find((x) => x.isDefault === true);
    const stdId = Number(std?.id ?? 0);

    // 1) „zum Standard machen" – so macht es die ChurchTools-Oberfläche selbst
    //    (`cs_song.js`: `makeAsStandardArrangement` → `apiPatch(".../arrangements/:id/default")`).
    console.log('\n  1) Standard wechseln per PATCH …/default (Weg der ChurchTools-Oberfläche):');
    const patch = await rest('PATCH', `/api/songs/${songId}/arrangements/${zweitId}/default`);
    const nachPatch = await restArrangements(songId);
    const jetztStd = nachPatch.find((x) => x.isDefault === true);
    const stdGewirkt = Number(jetztStd?.id) === zweitId;
    console.log(
      `    HTTP ${patch.status} → Standard danach #${String(jetztStd?.id)} (vorher #${stdId || '—'}) ${stdGewirkt ? '✓ GEWIRKT' : '✗ unverändert'}`,
    );
    console.log(`    Antwort: ${kurz(patch.json, 200)}`);
    zeigeArr('Stand', nachPatch);

    // 2) Quelle + Liednummer – der alte Dialog sendet `sourceId` (ID aus `songsource`) und
    //    `sourceReference` per PUT; ohne `sourceId` lehnt er `sourceReference` schon im Formular ab.
    console.log('\n  2) Quelle/Liednummer per PUT mit gültiger songsource-ID:');
    const quellen = master.songsource as Record<string, Record<string, unknown>> | undefined;
    const erste = quellen ? Object.values(quellen)[0] : undefined;
    const sourceId = Number(erste?.id ?? 0);
    console.log(`    songsource: ${quellen ? kurz(Object.values(quellen).map((q) => ({ id: q.id, name: q.name, shorty: q.shorty })), 300) : '– keine'}`);
    if (sourceId) {
      const vorherArr = nachPatch.find((x) => Number(x.id) === zweitId) ?? {};
      const put = await rest('PUT', `/api/songs/${songId}/arrangements/${zweitId}`, {
        name: 'Zweites',
        key: vorherArr.key ?? 'G',
        sourceId,
        sourceReference: '4711',
      });
      const nachPut = await restArrangements(songId);
      const z = nachPut.find((x) => Number(x.id) === zweitId);
      const src = z?.source as { id?: number; name?: string } | null | undefined;
      const gewirkt = String(z?.sourceReference ?? '') === '4711' && Number(src?.id) === sourceId;
      console.log(
        `    HTTP ${put.status} → source=${kurz(src ?? null, 120)} sourceReference=${String(z?.sourceReference ?? 'null')} ${gewirkt ? '✓ GEWIRKT' : '✗ unverändert'}`,
      );
      if (z) console.log(`    Arrangement danach (alle Felder): ${kurz(Object.fromEntries(Object.entries(z).filter(([k]) => !['files', 'links', 'meta', '@deprecated'].includes(k))), 700)}`);

      // 2b) Quelle wieder entfernen – geht `sourceId: null`?
      const put2 = await rest('PUT', `/api/songs/${songId}/arrangements/${zweitId}`, {
        name: 'Zweites',
        key: vorherArr.key ?? 'G',
        sourceId: null,
        sourceReference: null,
      });
      const nachPut2 = await restArrangements(songId);
      const z2 = nachPut2.find((x) => Number(x.id) === zweitId);
      const src2 = z2?.source as { id?: number } | null | undefined;
      console.log(
        `    Entfernen (sourceId:null): HTTP ${put2.status} → source=${kurz(src2 ?? null, 60)} ref=${String(z2?.sourceReference ?? 'null')} ${!src2 && !z2?.sourceReference ? '✓ GEWIRKT' : '✗ unverändert'}`,
      );
      // 2c) Liednummer ohne Quelle – nimmt die API das an?
      const put3 = await rest('PUT', `/api/songs/${songId}/arrangements/${zweitId}`, {
        name: 'Zweites',
        key: vorherArr.key ?? 'G',
        sourceReference: '99',
      });
      const z3 = (await restArrangements(songId)).find((x) => Number(x.id) === zweitId);
      console.log(
        `    Nur Liednummer ohne Quelle: HTTP ${put3.status} → ref=${String(z3?.sourceReference ?? 'null')} ${kurz(put3.json, 160)}`,
      );
    }

    // 3) Lesend: das Lied in der alten Welt (Feldnamen der Wahrheit).
    const alt2 = await alt('getAllSongs');
    const d = altDaten(alt2) as Record<string, Record<string, unknown>> | null;
    const meins = d?.[String(songId)];
    if (meins) {
      const arrs = Object.values((meins.arrangement ?? {}) as Record<string, unknown>);
      console.log(`\n  Testlied in getAllSongs: ${kurz(arrs.map((x) => { const o = { ...(x as Record<string, unknown>) }; delete o.files; return o; }), 900)}`);
    }
  } finally {
    const weg = await rest('DELETE', `/api/songs/${songId}`);
    const rest2 = await rest('GET', `/api/songs/${songId}`);
    console.log(`\n  Aufräumen: DELETE HTTP ${weg.status}, danach GET HTTP ${rest2.status} ${rest2.status === 404 ? '✓ weg' : '✗ NOCH DA'}`);
  }
}

async function main(): Promise<void> {
  console.log(`Ziel: ${BASE} (Test-Instanz)${SCHREIBEN ? ' – MIT Schreibdurchgang' : ' – lesend'}`);
  await anmelden();
  const master = await masterData();
  await alleLieder();
  if (SCHREIBEN) await schreibDurchgang(master);
  console.log('\nFertig.');
}

main().catch((e: unknown) => {
  console.error('✗ Fehler:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
