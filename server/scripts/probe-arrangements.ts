/**
 * Erkundung: Was gibt ChurchTools für die **Arrangement-Verwaltung in der App** her? (#396)
 *
 * Vier Fragen, die sich nicht lesend beantworten lassen und die man auch nicht raten darf – ein
 * falscher Payload auf ein Arrangement **löscht Felder** (gemessen 08.08.2026: ein `PUT {name, bpm}`
 * setzte Tonart, zweite Tonart und Dauer auf `null`):
 *
 *  1. **Wie heißen „Quelle" und „Liednummer"?** Der ChurchTools-Dialog zeigt sie, `CtArrangement`
 *     kennt sie nicht. Hängen sie am Arrangement oder am Lied?
 *  2. **Was macht `isDefault: true` mit dem bisherigen Standard?** Setzt ChurchTools ihn selbst
 *     zurück – oder gäbe es danach zwei Standard-Arrangements?
 *  3. **Lässt sich ein Arrangement löschen?** `DELETE /api/songs/:id/arrangements/:arrId`.
 *  4. **In welcher Einheit steht `duration`?** Der Dialog zeigt Minuten:Sekunden.
 *
 * Aufruf (lesend – zeigt die Felder eines vorhandenen Arrangements):
 *   npx tsx server/scripts/probe-arrangements.ts
 *
 * Aufruf mit Schreibdurchgang (legt ein Testlied an und räumt es am Ende wieder weg):
 *   npx tsx server/scripts/probe-arrangements.ts --ja-ich-will
 *
 * **ZWEI SPERREN, damit das nie die Gemeinde trifft** – wie in `probe-songwrite.ts`:
 *  1. Der Zugang kommt aus `.env.churchtools-test`; fehlt sie, bricht das Skript ab.
 *  2. Zeigt sie auf dieselbe Instanz wie `CHURCHTOOLS_BASE_URL`, bricht es ebenfalls ab.
 *
 * Bei HTTP 429 (Drosselung) sofortiger Abbruch (#300). Der Token wird nie ausgegeben.
 *
 * ── ERGEBNIS des Laufs vom 20.09.2026 (Test-Instanz, ChurchTools 3.136.x) ─────────────────────
 *
 * **Geht:** Arrangement anlegen, ändern und löschen mit `name`, `key` (Tonart), `tempo`, `beat`
 * (Takt), `duration` (Länge in **Sekunden** – 245 kam als 245 zurück, also 4:05) und `description`
 * (Beschreibung). `DELETE` antwortet 204, auch beim Standard-Arrangement.
 *
 * **⚠ Überholt durch `probe-arrangements-alt.ts` (20.09.2026):** Standard wechseln geht per
 * `PATCH …/arrangements/:arrId/default`, Quelle per `sourceId` aus `getMasterData → songsource`,
 * Liednummer als `sourceReference` nur zusammen mit einer Quelle. Die Befunde unten waren richtig
 * gemessen, aber an den falschen Wegen – die richtigen standen im JavaScript der Oberfläche.
 *
 * **Ging in DIESEM Lauf nicht (siehe oben):**
 *  - **Standard wechseln.** `PUT { isDefault: true }` antwortet **200 und ändert nichts** – genau die
 *    Falle „ein Erfolgssignal ist kein Beleg". Geprüft wurde deshalb der Stand danach, nicht der
 *    Status. Auch `POST …/default` (405), `PATCH …` (405) und `PUT /api/songs/:id`
 *    `{defaultArrangementId}` (400) wirken nicht. Das bleibt ChurchTools.
 *  - **Quelle und Liednummer.** `sourceName`, `sourceId` und `sourceReference` werden stillschweigend
 *    verworfen (bleiben `null`), und eine Quellen-Liste gibt die API nicht her (`/api/songsources`
 *    404, `/api/masterdata/songsources` 404). Im ChurchTools-Dialog ist „Quelle" ein Dropdown – die
 *    Werte kommen vermutlich aus der alten churchservice-Schnittstelle, wie die Lied-Kategorien.
 *
 * **Feld-Aliase, von ChurchTools selbst genannt** (`@deprecated` in jeder Arrangement-Antwort):
 * `bpm` → `tempo`, `keyOfArrangement` → `key`, `note` → `description`, `sourceName` → `source.name`.
 * Wer `note` UND `description` sendet, bekommt nur `description` zurück – es ist dasselbe Feld.
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

async function ruf(
  method: string,
  pfad: string,
  opts: { csrf?: string; body?: unknown } = {},
): Promise<Antwort> {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const headers: Record<string, string> = {
    Authorization: `Login ${TOKEN}`,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.csrf) headers['CSRF-Token'] = opts.csrf;

  const res = await fetch(`${BASE}${pfad}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 429) {
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    process.exit(1);
  }
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* kein JSON – Rohtext behalten */
  }
  return { status: res.status, json };
}

/** Der Datenteil einer ChurchTools-Antwort. */
function daten(a: Antwort): Record<string, unknown> | null {
  const d = (a.json as { data?: unknown } | null)?.data;
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
}

/** Felder eines Objekts mit ihren Werten – gekürzt, damit die Ausgabe lesbar bleibt. */
function zeige(titel: string, obj: Record<string, unknown> | null): void {
  if (!obj) {
    console.log(`  ${titel}: (kein Objekt)`);
    return;
  }
  console.log(`  ${titel}:`);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'files' || k === 'links' || k === 'meta') continue;
    const wert = v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    // `@deprecated` nennt die Feld-Nachfolger und wird deshalb NICHT gekürzt – genau dort steht,
    // welches Feld die App künftig schreiben soll.
    console.log(`    ${k.padEnd(22)} = ${k === '@deprecated' ? wert : wert.slice(0, 70)}`);
  }
}

/* ------------------------------------------------------------------ Frage 1 (lesend) */

async function felderEinesVorhandenen(): Promise<void> {
  console.log('\n── Frage 1a: Welche Felder hat ein vorhandenes Arrangement? (lesend) ──');
  const songs = await ruf('GET', '/api/songs?limit=5');
  const liste = (songs.json as { data?: Array<Record<string, unknown>> }).data ?? [];
  const mitArr = liste.find(
    (s) => Array.isArray(s.arrangements) && (s.arrangements as unknown[]).length > 0,
  );
  if (!mitArr) {
    console.log('  Kein Lied mit Arrangement gefunden – Frage bleibt für den Schreibdurchgang.');
    return;
  }
  const arr = (mitArr.arrangements as Array<Record<string, unknown>>)[0];
  console.log(`  Lied „${String(mitArr.name)}" (id ${String(mitArr.id)})`);
  zeige('Arrangement aus der Liste', arr);

  const einzeln = await ruf(
    'GET',
    `/api/songs/${String(mitArr.id)}/arrangements/${String(arr.id)}`,
  );
  console.log(`  Einzelabruf HTTP ${einzeln.status}`);
  zeige('Arrangement einzeln', daten(einzeln));

  console.log('\n  Und am LIED selbst (falls Quelle/Liednummer dort hängen):');
  const lied = await ruf('GET', `/api/songs/${String(mitArr.id)}`);
  const l = daten(lied);
  if (l) {
    const interessant = Object.fromEntries(
      Object.entries(l).filter(([k]) => !['arrangements', 'category', 'tags'].includes(k)),
    );
    zeige('Lied', interessant);
  }
}

/* ------------------------------------------------------------------ Schreibdurchgang */

async function schreibDurchgang(csrf: string): Promise<void> {
  console.log('\n── Schreibdurchgang auf der Test-Instanz ──');

  // Eine Kategorie-ID – **von einem vorhandenen Lied abgelesen**, nicht über `/api/songcategories`:
  // Den Endpunkt gibt es in dieser Form nicht (er antwortet leer); die App holt die Kategorien über
  // die alte churchservice-Schnittstelle (`getMasterData`, siehe `ctSongCategories.ts`). Für eine
  // Probe reicht die Kategorie, die ein bestehendes Lied schon trägt.
  const alle = await ruf('GET', '/api/songs?limit=5');
  const songListe = (alle.json as { data?: Array<Record<string, unknown>> }).data ?? [];
  const mitKat = songListe.find((s) => (s.category as { id?: number } | null)?.id !== undefined);
  const kat = (mitKat?.category ?? null) as { id: number; name?: string } | null;
  if (!kat) {
    console.log('  ✗ Keine Lied-Kategorie gefunden – Abbruch des Schreibdurchgangs.');
    return;
  }
  console.log(`  Kategorie: „${kat.name ?? '—'}" (id ${kat.id})`);

  const name = `ZZ-Probe Arrangements ${new Date().toISOString().slice(11, 19)}`;
  const neu = await ruf('POST', '/api/songs', {
    csrf,
    body: { name, categoryId: kat.id },
  });
  const songId = Number(daten(neu)?.id ?? 0);
  console.log(`  Lied anlegen: HTTP ${neu.status}, songId ${songId || '—'}`);
  if (!songId) {
    console.log('  ✗ Ohne songId geht es nicht weiter.');
    return;
  }

  try {
    // ── Frage 1b: Welche Felder nimmt ChurchTools beim ANLEGEN an? ──
    console.log('\n── Frage 1b: Welche Felder nimmt ein neues Arrangement an? ──');
    const versuch = {
      name: 'Probe-Arrangement',
      isDefault: true,
      key: 'D',
      keyOfArrangement: 'D',
      tempo: 96,
      beat: '4/4',
      duration: 245, // Frage 4: Sekunden? 245 s = 4:05
      description: 'Beschreibung aus der Probe',
      note: 'Notiz aus der Probe',
      // Die beiden Kandidaten für „Quelle" und „Liednummer" aus dem ChurchTools-Dialog:
      sourceName: 'Feiert Jesus',
      sourceReference: '123',
    };
    const a1 = await ruf('POST', `/api/songs/${songId}/arrangements`, { csrf, body: versuch });
    const arr1Id = Number(daten(a1)?.id ?? 0);
    console.log(`  POST /arrangements: HTTP ${a1.status}, id ${arr1Id || '—'}`);
    if (a1.status >= 400) console.log(`  Antwort: ${JSON.stringify(a1.json).slice(0, 400)}`);

    if (arr1Id) {
      const gelesen = await ruf('GET', `/api/songs/${songId}/arrangements/${arr1Id}`);
      const g = daten(gelesen);
      zeige('So kam es zurück', g);
      console.log('\n  Abgleich mit dem Gesendeten:');
      for (const [k, gesendet] of Object.entries(versuch)) {
        const zurueck = g?.[k];
        const gleich = String(zurueck ?? '') === String(gesendet);
        console.log(
          `    ${k.padEnd(18)} gesendet ${String(gesendet).padEnd(26)} zurück ${String(zurueck ?? 'FEHLT')}${gleich ? '' : '   ← abweichend'}`,
        );
      }
      const dauer = g?.duration;
      console.log(
        `\n  Frage 4 (Einheit von duration): gesendet 245 → zurück ${String(dauer)} ` +
          `${String(dauer) === '245' ? '(Sekunden – 4:05)' : '(ABWEICHEND, bitte im Dialog gegenprüfen)'}`,
      );
    }

    // ── Frage 2: Was macht isDefault: true mit dem bisherigen Standard? ──
    console.log('\n── Frage 2: Standard wechseln ──');
    const a2 = await ruf('POST', `/api/songs/${songId}/arrangements`, {
      csrf,
      body: { name: 'Zweites Arrangement', isDefault: false, key: 'G' },
    });
    const arr2Id = Number(daten(a2)?.id ?? 0);
    console.log(`  Zweites Arrangement: HTTP ${a2.status}, id ${arr2Id || '—'}`);

    if (arr2Id) {
      // Lesen–ändern–schreiben wie in der App: Payload aus dem Ist-Zustand, nur isDefault darüber.
      const ist = daten(await ruf('GET', `/api/songs/${songId}/arrangements/${arr2Id}`)) ?? {};
      const body: Record<string, unknown> = { isDefault: true };
      for (const f of [
        'name',
        'key',
        'keyOfArrangement',
        'beat',
        'duration',
        'description',
        'note',
        'tempo',
      ]) {
        if (ist[f] !== null && ist[f] !== undefined) body[f] = ist[f];
      }
      const put = await ruf('PUT', `/api/songs/${songId}/arrangements/${arr2Id}`, { csrf, body });
      console.log(`  PUT isDefault:true auf das zweite: HTTP ${put.status}`);

      // **Die Antwort allein beweist nichts** – ein HTTP 200 sagt nur, dass der Aufruf ankam.
      // Geprüft wird, ob DIESES Arrangement danach wirklich Standard ist.
      const stand = async (): Promise<Array<Record<string, unknown>>> =>
        (daten(await ruf('GET', `/api/songs/${songId}`))?.arrangements ?? []) as Array<
          Record<string, unknown>
        >;
      const zeigeStand = (arrs: Array<Record<string, unknown>>, was: string): boolean => {
        console.log(`  ${was}:`);
        for (const a of arrs) {
          console.log(
            `    id ${String(a.id).padEnd(6)} „${String(a.name)}"  isDefault = ${String(a.isDefault)}`,
          );
        }
        return arrs.find((a) => Number(a.id) === arr2Id)?.isDefault === true;
      };
      let geschafft = zeigeStand(await stand(), 'Nach dem PUT');
      console.log(
        geschafft
          ? '  → Der PUT hat gewirkt.'
          : '  → ⚠️ Der PUT hat NICHT gewirkt (HTTP 200, aber isDefault unverändert).',
      );

      // Zweiter Versuch: ein eigener Endpunkt, wie ihn der ChurchTools-Dialog („Arrangement zum
      // Standard machen") vermuten lässt.
      if (!geschafft) {
        for (const kandidat of [
          { method: 'POST', pfad: `/api/songs/${songId}/arrangements/${arr2Id}/default` },
          {
            method: 'PATCH',
            pfad: `/api/songs/${songId}/arrangements/${arr2Id}`,
            body: { isDefault: true },
          },
          { method: 'PUT', pfad: `/api/songs/${songId}`, body: { defaultArrangementId: arr2Id } },
        ]) {
          const v = await ruf(kandidat.method, kandidat.pfad, { csrf, body: kandidat.body });
          const wirkt = (await stand()).find((a) => Number(a.id) === arr2Id)?.isDefault === true;
          console.log(
            `  ${kandidat.method} ${kandidat.pfad}${kandidat.body ? ` ${JSON.stringify(kandidat.body)}` : ''}` +
              ` → HTTP ${v.status}${wirkt ? '  ✓ WIRKT' : ''}`,
          );
          if (wirkt) {
            geschafft = true;
            break;
          }
        }
        if (!geschafft) {
          console.log(
            '  → Keiner der Versuche hat den Standard gewechselt. Die App kann „zum Standard machen"\n' +
              '    vorerst NICHT anbieten – das bleibt ChurchTools.',
          );
        }
      }
    }

    // ── Frage 1c: Wie kommt die „Quelle" ans Arrangement? ──
    console.log('\n── Frage 1c: Quelle (Dropdown) und Liednummer ──');
    for (const pfad of ['/api/songsources', '/api/songs/sources', '/api/masterdata/songsources']) {
      const v = await ruf('GET', pfad);
      const anz = Array.isArray((v.json as { data?: unknown[] }).data)
        ? (v.json as { data: unknown[] }).data.length
        : '—';
      console.log(`  GET ${pfad.padEnd(32)} → HTTP ${v.status}, Einträge: ${anz}`);
      if (v.status === 200 && anz !== '—' && Number(anz) > 0) {
        console.log(`    ${JSON.stringify((v.json as { data: unknown[] }).data.slice(0, 3))}`);
      }
    }
    if (arr1Id) {
      // `sourceName` kam nicht an – der Dialog zeigt ein Dropdown, also ist es vermutlich eine ID.
      const mitId = await ruf('PUT', `/api/songs/${songId}/arrangements/${arr1Id}`, {
        csrf,
        body: {
          name: 'Probe-Arrangement',
          key: 'D',
          tempo: 96,
          sourceId: 1,
          sourceReference: '42',
        },
      });
      const nach = daten(await ruf('GET', `/api/songs/${songId}/arrangements/${arr1Id}`));
      console.log(
        `  PUT mit sourceId:1 + sourceReference:'42' → HTTP ${mitId.status}; danach ` +
          `sourceId=${String(nach?.sourceId)}, source=${JSON.stringify(nach?.source)}, ` +
          `sourceReference=${String(nach?.sourceReference)}`,
      );
    }

    // ── Frage 3: Lässt sich ein Arrangement löschen? ──
    console.log('\n── Frage 3: Arrangement löschen ──');
    if (arr1Id) {
      const del = await ruf('DELETE', `/api/songs/${songId}/arrangements/${arr1Id}`, { csrf });
      console.log(`  DELETE (Nicht-Standard): HTTP ${del.status}`);
      if (del.status >= 400) console.log(`  Antwort: ${JSON.stringify(del.json).slice(0, 300)}`);
    }
    if (arr2Id) {
      const delStd = await ruf('DELETE', `/api/songs/${songId}/arrangements/${arr2Id}`, { csrf });
      console.log(
        `  DELETE (das letzte/Standard): HTTP ${delStd.status}` +
          (delStd.status >= 400 ? ' – ChurchTools schützt es' : ' – geht auch'),
      );
      if (delStd.status >= 400)
        console.log(`  Antwort: ${JSON.stringify(delStd.json).slice(0, 300)}`);
    }
  } finally {
    // Aufräumen: Das Testlied verschwindet, egal wie der Durchgang ausging.
    const weg = await ruf('DELETE', `/api/songs/${songId}`, { csrf });
    console.log(`\n  Aufgeräumt: Testlied gelöscht (HTTP ${weg.status}).`);
  }
}

async function main(): Promise<void> {
  console.log(`ChurchTools-Test-Instanz: ${BASE}`);

  await felderEinesVorhandenen();

  if (!SCHREIBEN) {
    console.log(
      '\nHinweis: Der Durchgang, der wirklich anlegt, ändert und löscht (und danach aufräumt), läuft nur mit\n' +
        '  npx tsx server/scripts/probe-arrangements.ts --ja-ich-will',
    );
    console.log('\nFertig.\n');
    return;
  }

  // **CSRF nur, wenn ChurchTools hier wirklich einen Token liefert.** Mit `Authorization: Login <token>`
  // antwortet `/api/csrftoken` auf dieser Instanz mit einem OBJEKT statt einer Zeichenkette – der
  // CSRF-Schutz gilt der Cookie-Sitzung, nicht der Token-Anmeldung. Läuft der Schreibversuch dann in
  // einen 403, sagt das die Antwort deutlich; ein erfundener Token brächte nichts.
  const csrfRes = await ruf('GET', '/api/csrftoken');
  const rohData = (csrfRes.json as { data?: unknown }).data;
  const csrf = typeof rohData === 'string' ? rohData : '';
  if (!csrf) {
    const form =
      rohData && typeof rohData === 'object'
        ? `Objekt mit ${Object.keys(rohData).join(', ')}`
        : typeof rohData;
    console.log(
      `\n  Hinweis: kein CSRF-Token als Zeichenkette (HTTP ${csrfRes.status}, data = ${form}).\n` +
        '  Weiter ohne – die Token-Anmeldung braucht ihn vermutlich nicht.',
    );
  }
  await schreibDurchgang(csrf);
  console.log('\nFertig.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ Abbruch:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
