/**
 * Erkundungs-Skript für SCHREIBENDE Agenda-Operationen in ChurchTools.
 * Klärt die zwei offenen Fragen für die Tester-Anmerkungen 1 & 2:
 *   1) Lässt sich ein bestehender "text"-Punkt per PUT mit top-level arrangementId
 *      sauber in ein Lied (type "song") umwandeln – oder beschädigt CT den Punkt?
 *   2) Wie sieht der korrekte responsible-Payload mit echten Personen + Dienst aus,
 *      und welche Endpoints liefern Personensuche bzw. die Dienst-/Rollen-Liste?
 *
 * SICHERHEIT: Lese-Probes laufen immer und ändern nichts. Schreib-Probes laufen nur
 * mit DO_WRITES=1 und arbeiten AUSSCHLIESSLICH an selbst angelegten Wegwerf-Punkten
 * (anlegen → testen → am Ende wieder löschen). Bestehende Ablaufpunkte werden nie
 * verändert.
 *
 * Aufruf (rein lesend):
 *   TEST_EVENT_ID=1500 npx tsx server/scripts/probe-agenda-write.ts
 * Aufruf (mit Schreib-Probe an Wegwerf-Punkten):
 *   TEST_EVENT_ID=1500 TEST_ARRANGEMENT_ID=42 TEST_PERSON_ID=7 DO_WRITES=1 \
 *     npx tsx server/scripts/probe-agenda-write.ts
 *
 * Liest CHURCHTOOLS_BASE_URL + CHURCHTOOLS_LOGIN_TOKEN aus der .env im Projektstamm.
 * Der Token wird nie ausgegeben.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const EVENT_ID = Number(process.env.TEST_EVENT_ID ?? '');
const ARRANGEMENT_ID = process.env.TEST_ARRANGEMENT_ID ? Number(process.env.TEST_ARRANGEMENT_ID) : null;
const PERSON_ID = process.env.TEST_PERSON_ID ? Number(process.env.TEST_PERSON_ID) : null;
const DO_WRITES = process.env.DO_WRITES === '1';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}
if (!EVENT_ID) {
  console.error('✗ TEST_EVENT_ID fehlt (z.B. TEST_EVENT_ID=1500).');
  process.exit(1);
}

/** Session-Cookie + CSRF-Token (für schreibende Calls) – Login-Token-Header allein reicht nicht. */
let COOKIE = '';
let CSRF = '';

function extractSessionCookie(res: Response): string | null {
  const cookies =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const c of cookies) {
    const match = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/** Holt per login_token ein Session-Cookie + danach ein CSRF-Token. */
async function authenticate(): Promise<void> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`whoami fehlgeschlagen: ${res.status} ${res.statusText}`);
  const cookie = extractSessionCookie(res);
  if (!cookie) throw new Error('Kein Session-Cookie von whoami erhalten.');
  COOKIE = cookie;

  const csrfRes = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: COOKIE, Accept: 'application/json' },
  });
  if (!csrfRes.ok) throw new Error(`CSRF-Token fehlgeschlagen: ${csrfRes.status}`);
  CSRF = ((await csrfRes.json()) as { data?: string }).data ?? '';
}

async function ctGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: COOKIE, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} bei GET ${path}`);
  return res.json();
}

/** Schreibender Call (POST/PUT/DELETE) mit Cookie + CSRF. Liefert {status, body}. */
async function ctWrite(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Cookie: COOKIE,
      'CSRF-Token': CSRF,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* leerer Body möglich */
  }
  return { status: res.status, body: parsed };
}

function show(label: string, data: unknown, maxLen = 1800): void {
  const json = JSON.stringify(
    data,
    (_k, v) => (typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…[gekürzt]' : v),
    2,
  );
  console.log(`\n=== ${label} ===`);
  console.log(json.length > maxLen ? json.slice(0, maxLen) + '\n…[Ausgabe gekürzt]' : json);
}

interface CtItem {
  id: number;
  title?: string;
  type?: string;
  song?: unknown;
  responsible?: unknown;
}

async function main(): Promise<void> {
  console.log(`Agenda-Schreib-Probe gegen ${BASE} · Event ${EVENT_ID}\n`);
  await authenticate();
  console.log('✓ Session + CSRF erhalten.');

  // ---------- LESE-PROBES (immer) ----------

  // 1) Struktur der Agenda-Punkte – besonders responsible-Form + type + song
  const agenda = (await ctGet(`/api/events/${EVENT_ID}/agenda`)) as { data?: { items?: CtItem[] } };
  const items = agenda.data?.items ?? [];
  console.log(`\nAgenda hat ${items.length} Punkte.`);
  for (const it of items.slice(0, 6)) {
    show(`Punkt #${it.id} (type=${it.type})`, {
      title: it.title,
      type: it.type,
      hasSong: !!it.song,
      responsible: it.responsible,
    });
  }

  // 2) Personensuche-Endpoint testen
  try {
    const persons = (await ctGet(`/api/persons?query=a&limit=3`)) as { data?: unknown };
    show('GET /api/persons?query=a (Personensuche)', persons.data ?? persons);
  } catch (e) {
    console.log(`\n✗ Personensuche /api/persons fehlgeschlagen: ${(e as Error).message}`);
  }

  // 3) Dienst-/Rollen-Liste (CT-"services") – Kandidaten-Endpoints
  for (const path of ['/api/services', '/api/servicegroups']) {
    try {
      const data = (await ctGet(`${path}`)) as { data?: unknown };
      show(`GET ${path} (Dienste/Rollen)`, data.data ?? data);
    } catch (e) {
      console.log(`\n✗ ${path} fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  // ---------- SCHREIB-PROBES (nur mit DO_WRITES=1, an Wegwerf-Punkten) ----------
  if (!DO_WRITES) {
    console.log('\n(Schreib-Probes übersprungen – mit DO_WRITES=1 aktivieren.)');
    return;
  }

  const cleanup: number[] = [];
  try {
    // PROBE A: text-Punkt anlegen → per PUT mit arrangementId in Lied umwandeln → prüfen
    if (ARRANGEMENT_ID) {
      console.log('\n--- PROBE A: text → song Umwandlung ---');
      const created = await ctWrite('POST', `/api/events/${EVENT_ID}/agenda/items`, {
        type: 'text',
        title: 'PROBE-WEGWERF (text→song)',
      });
      show('A1 angelegter text-Punkt', created);
      const newId = (created.body as { data?: { id?: number } })?.data?.id;
      if (newId) {
        cleanup.push(newId);
        // Variante 1: type:'song' + top-level arrangementId
        const conv = await ctWrite('PUT', `/api/events/${EVENT_ID}/agenda/items/${newId}`, {
          type: 'song',
          title: 'PROBE-WEGWERF',
          arrangementId: ARRANGEMENT_ID,
        });
        show('A2 PUT type=song + arrangementId', conv);
        const after = (await ctGet(`/api/events/${EVENT_ID}/agenda`)) as { data?: { items?: CtItem[] } };
        const it = after.data?.items?.find((x) => x.id === newId);
        show('A3 Punkt nach Umwandlung (hat song?)', { type: it?.type, hasSong: !!it?.song, song: it?.song });
      }
    } else {
      console.log('\n(PROBE A übersprungen – TEST_ARRANGEMENT_ID nicht gesetzt.)');
    }

    // PROBE B: responsible mit echter Person setzen → prüfen
    if (PERSON_ID) {
      console.log('\n--- PROBE B: responsible mit Person ---');
      const created = await ctWrite('POST', `/api/events/${EVENT_ID}/agenda/items`, {
        type: 'text',
        title: 'PROBE-WEGWERF (responsible)',
      });
      const newId = (created.body as { data?: { id?: number } })?.data?.id;
      if (newId) {
        cleanup.push(newId);
        // Mehrere Format-Kandidaten nacheinander probieren (jeweils GET-Gegenprüfung).
        const candidates: Array<{ label: string; payload: Record<string, unknown> }> = [
          { label: 'persons:[{personId}]', payload: { responsible: { persons: [{ personId: PERSON_ID }] } } },
          { label: 'personIds:[id]', payload: { responsible: { personIds: [PERSON_ID] } } },
          { label: 'responsible:[{personId}]', payload: { responsible: [{ personId: PERSON_ID }] } },
        ];
        for (const c of candidates) {
          const r = await ctWrite('PUT', `/api/events/${EVENT_ID}/agenda/items/${newId}`, {
            type: 'text',
            title: 'PROBE-WEGWERF',
            ...c.payload,
          });
          const after = (await ctGet(`/api/events/${EVENT_ID}/agenda`)) as { data?: { items?: CtItem[] } };
          const it = after.data?.items?.find((x) => x.id === newId);
          show(`B · Format "${c.label}" → status ${r.status}`, { responsible: it?.responsible });
        }
      }
    } else {
      console.log('\n(PROBE B übersprungen – TEST_PERSON_ID nicht gesetzt.)');
    }
  } finally {
    // Aufräumen: alle Wegwerf-Punkte wieder löschen.
    for (const id of cleanup) {
      const del = await ctWrite('DELETE', `/api/events/${EVENT_ID}/agenda/items/${id}`);
      console.log(`Cleanup: Punkt #${id} gelöscht (status ${del.status}).`);
    }
  }
}

main().catch((e) => {
  console.error('\n✗ Probe abgebrochen:', e instanceof Error ? e.message : e);
  process.exit(1);
});
