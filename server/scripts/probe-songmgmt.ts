/**
 * Erkundung: Was gibt die ChurchTools-API für eine **Liedverwaltung in der App** wirklich her?
 *
 * Hintergrund: Die App kann heute ChordPro-Versionen anlegen/ändern/löschen. Der Wunsch geht weiter –
 * Lieder anlegen, Dateien hoch- und runterladen, Stammdaten pflegen. Eine Recherche vom 26.06.2026
 * kam zum Ergebnis „möglich, aber die REST-Endpunkte für Lieder sind noch nicht ganz rund". Das ist
 * alt; dieses Skript prüft den heutigen Stand an der echten Instanz.
 *
 * Aufruf:  npx tsx server/scripts/probe-songmgmt.ts
 *
 * **STRENG LESEND.** Nichts wird angelegt, geändert oder gelöscht; der Token wird nie ausgegeben.
 * Bis auf eine Ausnahme sind es reine GET-Anfragen: `getMasterData` über die alte
 * churchservice-Schnittstelle ist ein **POST, der nur liest** (sie kennt keine GETs). Diese
 * Unterscheidung steht hier, weil im Kopf früher „ausschließlich GET" stand – eine Aussage, die
 * nach der Ergänzung nicht mehr gestimmt hätte.
 *
 * Bei HTTP 429 (Drosselung) bricht das Skript SOFORT ab: Unsere eigene App hat ChurchTools schon
 * einmal überfahren (#300), danach scheiterten Login, Rechte und Speichern gleichzeitig. Das
 * passiert kein zweites Mal wegen eines Erkundungs-Skripts.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

/** Pause zwischen zwei Anfragen – bewusst gemütlich, das hier hat es nicht eilig. */
const PAUSE_MS = 400;

interface Antwort {
  status: number;
  json: unknown;
}

let abgebrochen = false;

async function get(pfad: string): Promise<Antwort> {
  if (abgebrochen) return { status: 0, json: null };
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    abgebrochen = true;
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch. Später erneut versuchen.');
    return { status: 429, json: null };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

/** Kurzform: gibt es den Endpunkt, und wie sieht die Antwort grob aus? */
async function pruefe(name: string, pfad: string): Promise<Antwort> {
  const a = await get(pfad);
  if (a.status === 0) return a;
  const zeichen = a.status === 200 ? '✓' : a.status === 403 ? '⊘' : a.status === 404 ? '✗' : '?';
  const hinweis =
    a.status === 403 ? ' (keine Berechtigung)' : a.status === 404 ? ' (gibt es nicht)' : '';
  console.log(`  ${zeichen} ${String(a.status).padEnd(3)} ${name}${hinweis}`);
  return a;
}

/** Die Felder eines Datensatzes auflisten – daraus folgt, was ein Anlege-Formular können muss. */
function felder(json: unknown): string[] {
  const d = (json as { data?: unknown })?.data;
  const erst = Array.isArray(d) ? d[0] : d;
  return erst && typeof erst === 'object' ? Object.keys(erst as object).sort() : [];
}

/**
 * **Woher die Kategorie-NAMEN kommen** (#322, Schritt 7).
 *
 * Unter `/api/` gibt es sie nicht – alle geratenen Pfade antworten 404 (oben mitgeprüft, damit dieser
 * Befund nicht in Erzählform in einer Doku steht, sondern jederzeit nachlaufbar ist). Die alte
 * churchservice-Schnittstelle liefert sie: `func=getMasterData` → `songcategory`.
 *
 * Das ist wichtig, weil die Liedliste nur die Kategorien nennt, die auch **benutzt** werden. Bei der
 * ECG sind das 49 Lieder in genau einer Kategorie; die zweite erlaubte („Inaktive Songs") kommt in
 * keinem Lied vor. Ohne diesen Aufruf hieße sie in der App „Kategorie 1".
 *
 * **Bewusst eigenes `fetch` statt der Server-Module.** Ein Erkundungsskript, das über unseren eigenen
 * Code läuft, prüft unsere Annahmen gegen sich selbst. Die anderen `probe-*.ts` halten es genauso.
 */
async function kategorienUeberAjax(): Promise<void> {
  if (abgebrochen) return;
  console.log('\n── Kategorie-Namen über die alte Schnittstelle (POST, liest nur) ──');

  // Die alte Schnittstelle kennt den `Authorization: Login`-Kopf nicht; sie braucht ein
  // Session-Cookie. Das gibt es über `whoami?login_token=…` (so steht es in der CLAUDE.md für
  // Datei-Downloads) – plus ein CSRF-Token, das auch lesende Aufrufe verlangen.
  const who = await fetch(`${BASE}/api/whoami?login_token=${TOKEN}`, { redirect: 'manual' });
  const cookie = (who.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) {
    console.log('  ✗ Kein Session-Cookie erhalten – Kategorie-Namen nicht prüfbar.');
    return;
  }
  const csrfRes = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  const csrf = ((await csrfRes.json()) as { data?: string }).data;
  if (!csrf) {
    console.log('  ✗ Kein CSRF-Token erhalten – Kategorie-Namen nicht prüfbar.');
    return;
  }

  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'CSRF-Token': csrf,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ func: 'getMasterData' }),
  });
  const text = await res.text();
  let daten: unknown;
  try {
    const aussen = JSON.parse(text) as { status?: string; data?: unknown };
    if (aussen.status !== 'success') {
      console.log(`  ✗ getMasterData meldet „${String(aussen.status)}".`);
      return;
    }
    daten = typeof aussen.data === 'string' ? JSON.parse(aussen.data) : aussen.data;
  } catch {
    console.log(`  ✗ Antwort nicht lesbar (${res.status}).`);
    return;
  }
  const kategorien = (daten as { songcategory?: unknown }).songcategory;
  console.log(`  ✓ ${res.status} getMasterData → songcategory:`);
  console.log(`      ${JSON.stringify(kategorien)}`);
  console.log(
    '      ⚠️  Beachten: `id` kommt als ZEICHENKETTE, das Namensfeld heißt `bezeichnung`.',
  );
}

async function main(): Promise<void> {
  console.log(`\nChurchTools-Erkundung „Liedverwaltung" – NUR LESEND\nInstanz: ${BASE}\n`);

  console.log('── Grundlagen ──');
  const info = await pruefe('Instanz-Info (Version)', '/api/info');
  const v = (info.json as { build?: string; version?: string } | null) ?? {};
  if (v.version || v.build)
    console.log(`      → Version ${v.version ?? '?'} (Build ${v.build ?? '?'})`);

  console.log('\n── Lieder lesen ──');
  const liste = await pruefe('Liedliste', '/api/songs?limit=1');
  const songFelder = felder(liste.json);
  if (songFelder.length) console.log(`      → Felder: ${songFelder.join(', ')}`);

  const d = (liste.json as { data?: { id?: number }[] } | null)?.data;
  const songId = Array.isArray(d) && d[0]?.id ? d[0].id : null;
  if (!songId) {
    console.log('\n⚠️  Kein Lied gefunden – die folgenden Prüfungen brauchen eins.');
    return;
  }
  console.log(`      → Beispiel-Lied #${songId}`);

  /**
   * **Die FORM von `category` und `ccli`, nicht nur ihre Anwesenheit** (#322, Schritt 7).
   *
   * Die Feldliste oben sagt, dass es beide gibt – über ihre Gestalt sagt sie nichts. Genau daran
   * hängen zwei Entscheidungen: Ob die Kategorie-Auswahl einen **Namen** anzeigen kann (oder nur eine
   * Zahl), und ob sich ein Doppel-Anlegen an der **CCLI-Nummer** erkennen lässt, ohne für jedes Lied
   * einen Einzelabruf zu machen – letzteres wären ~250 Anfragen und damit genau #300.
   */
  const erstesLied = (liste.json as { data?: Record<string, unknown>[] } | null)?.data?.[0];
  if (erstesLied) {
    console.log(`      → category = ${JSON.stringify(erstesLied.category)}`);
    console.log(
      `      → ccli = ${JSON.stringify(erstesLied.ccli)} (Typ ${typeof erstesLied.ccli})`,
    );
  }

  const einzeln = await pruefe(`Einzelnes Lied #${songId}`, `/api/songs/${songId}`);
  const einzelFelder = felder(einzeln.json);
  if (einzelFelder.length) console.log(`      → Felder: ${einzelFelder.join(', ')}`);

  // Arrangements: hängen Tonart, Tempo und Dateien dran (wichtig für Wunsch „Arrangements abbilden")
  const arr = (einzeln.json as { data?: { arrangements?: Record<string, unknown>[] } } | null)?.data
    ?.arrangements;
  if (Array.isArray(arr) && arr[0]) {
    console.log(
      `      → ${arr.length} Arrangement(s), Felder: ${Object.keys(arr[0]).sort().join(', ')}`,
    );
  }

  console.log('\n── Stammdaten, die ein Anlege-Formular bräuchte ──');
  const kat = await pruefe('Lied-Kategorien', '/api/songcategories');
  if (felder(kat.json).length) console.log(`      → Felder: ${felder(kat.json).join(', ')}`);
  await pruefe('Tonarten (musical keys)', '/api/musicalkeys');
  await pruefe('Masterdata Lieder', '/api/masterdata/songs');
  await pruefe('Masterdata churchservice', '/api/masterdata/churchservice');
  await pruefe('Masterdata (ohne Modul)', '/api/masterdata');
  await kategorienUeberAjax();

  console.log('\n── Dateien am Arrangement ──');
  const arrId = Array.isArray(arr) && typeof arr[0]?.id === 'number' ? (arr[0].id as number) : null;
  if (arrId) {
    const dateien = await pruefe(
      `Dateien von Arrangement #${arrId}`,
      `/api/files/song_arrangement/${arrId}`,
    );
    if (felder(dateien.json).length)
      console.log(`      → Felder: ${felder(dateien.json).join(', ')}`);
  }

  console.log('\n── Wo die Schreibwege dokumentiert wären ──');
  await pruefe('OpenAPI/Swagger-Beschreibung', '/api/swagger.json');
  await pruefe('Alternative: /api/docs', '/api/docs');

  console.log('\n── Rechte des angemeldeten Kontos ──');
  const perm = await pruefe('Eigene Berechtigungen', '/api/permissions/global');
  const songRechte = (perm.json as { data?: { song?: Record<string, unknown> } } | null)?.data
    ?.song;
  if (songRechte) console.log(`      → song: ${JSON.stringify(songRechte)}`);
  /**
   * **`edit songcategory` nennt die erlaubten Kategorie-IDs, nicht bloß ja/nein** (#322).
   *
   * `parseCapabilities` verdichtet das Recht heute zu einem Bool (`canEditSongs`). Für das
   * Anlege-Formular ist die **Liste** nötig: Ohne sie bietet die App Kategorien an, die ChurchTools
   * danach ablehnt. Nur diese zwei Einträge werden ausgegeben – der ganze Rechte-Block wäre lang und
   * hat hier nichts zu suchen.
   */
  const cs = (perm.json as { data?: { churchservice?: Record<string, unknown> } } | null)?.data
    ?.churchservice;
  if (cs) {
    console.log(
      `      → churchservice['edit songcategory'] = ${JSON.stringify(cs['edit songcategory'])}`,
    );
    console.log(
      `      → churchservice['view songcategory'] = ${JSON.stringify(cs['view songcategory'])}`,
    );
  }

  /**
   * **Was der Bestand über die geplanten Regeln sagt** (#322).
   *
   * Zwei Fragen lassen sich nur an den echten Daten beantworten, und beide entscheiden über die
   * Oberfläche:
   *  1. **Welche Kategorien kommen überhaupt vor?** Einen Endpunkt für Kategorien gibt es nicht (404,
   *     siehe oben) – die Auswahl kann nur aus den Liedern gebildet werden. Ist eine erlaubte
   *     Kategorie in keinem Lied benutzt, kennt die App ihren Namen nicht.
   *  2. **Gibt es schon Lieder mit gleicher CCLI-Nummer?** Die Blockade beim Anlegen wäre sonst eine
   *     Regel, die der eigene Bestand verletzt – das gehört gewusst, bevor sie gebaut wird.
   *
   * Drei bis vier Seitenabrufe, gemütlich getaktet – kein Vergleich zu den ~250 Anfragen aus #300.
   */
  console.log('\n── Der Bestand: Kategorien und CCLI-Nummern ──');
  interface RohLied {
    id: number;
    name: string;
    ccli?: unknown;
    category?: { id?: number; name?: string } | null;
  }
  const alle: RohLied[] = [];
  for (let page = 1; page <= 50; page++) {
    const a = await get(`/api/songs?limit=100&page=${page}`);
    if (a.status !== 200) break;
    const teil = ((a.json as { data?: RohLied[] }).data ?? []) as RohLied[];
    alle.push(...teil);
    if (teil.length < 100) break;
  }
  console.log(`  ${alle.length} Lieder gelesen`);

  const kategorien = new Map<number, { name: string; anzahl: number }>();
  for (const l of alle) {
    const id = l.category?.id;
    if (typeof id !== 'number') continue;
    const e = kategorien.get(id) ?? { name: l.category?.name ?? '(ohne Namen)', anzahl: 0 };
    e.anzahl++;
    kategorien.set(id, e);
  }
  for (const [id, e] of [...kategorien].sort((a, b) => a[0] - b[0])) {
    console.log(`  Kategorie ${id}: „${e.name}" – ${e.anzahl} Lied(er)`);
  }

  const mitCcli = alle.filter((l) => String(l.ccli ?? '').trim().length > 0);
  console.log(`  CCLI-Nummer gesetzt bei ${mitCcli.length} von ${alle.length} Liedern`);
  const nachCcli = new Map<string, string[]>();
  for (const l of mitCcli) {
    const k = String(l.ccli).trim();
    nachCcli.set(k, [...(nachCcli.get(k) ?? []), l.name]);
  }
  const doppelt = [...nachCcli].filter(([, namen]) => namen.length > 1);
  if (doppelt.length === 0) {
    console.log(
      '  ✓ Keine CCLI-Nummer kommt doppelt vor – eine Blockade widerspricht dem Bestand nicht.',
    );
  } else {
    console.log(`  ⚠️  ${doppelt.length} CCLI-Nummer(n) mehrfach vergeben:`);
    for (const [nr, namen] of doppelt) console.log(`      ${nr}: ${namen.join(' | ')}`);
  }

  console.log('\nFertig. Nichts wurde verändert.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ Abbruch:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
