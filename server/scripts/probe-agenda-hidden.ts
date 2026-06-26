/**
 * Diagnose: Wie erkennt/setzt man das „Uhrzeit ausblenden" (durchgestrichenes Auge) eines
 * Agenda-Punkts in ChurchTools? Liest die echte Agenda und dumpt ALLE Felder jedes Punkts,
 * damit wir sehen, woran ein ausgeblendeter Punkt erkennbar ist (start=null? verstecktes Feld?).
 *
 * Optional (DO_WRITES=1): testet hide/unhide an einem genannten Punkt und vergleicht die Agenda
 * davor/danach – zeigt, ob der Aufruf die start-Zeit wirklich entfernt.
 *
 * Aufruf (nur lesen):  npx tsx server/scripts/probe-agenda-hidden.ts
 * Liest CHURCHTOOLS_BASE_URL + CHURCHTOOLS_LOGIN_TOKEN aus der .env. Token wird nie ausgegeben.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const TEST_HIDE_ITEM = process.env.TEST_HIDE_ITEM ? Number(process.env.TEST_HIDE_ITEM) : null;
const DO_WRITES = process.env.DO_WRITES === '1';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

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
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) return m[1];
  }
  return null;
}

async function authenticate(): Promise<void> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`whoami fehlgeschlagen: ${res.status}`);
  const cookie = extractSessionCookie(res);
  if (!cookie) throw new Error('Kein Session-Cookie erhalten.');
  COOKIE = cookie;
  const me = (await res.json()) as { data?: { firstName?: string; lastName?: string } };
  console.log(`✓ Angemeldet als ${me.data?.firstName ?? '?'} ${me.data?.lastName ?? ''}`);

  const csrfRes = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: COOKIE, Accept: 'application/json' },
  });
  CSRF = ((await csrfRes.json()) as { data?: string }).data ?? '';
}

async function ctGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: COOKIE, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} bei GET ${path}`);
  return res.json();
}

async function ctPost(path: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Cookie: COOKIE, 'CSRF-Token': CSRF, Accept: 'application/json' },
  });
  return res.status;
}

interface RawItem {
  id: number;
  title?: string;
  type?: string;
  start?: string | null;
  isBeforeEvent?: boolean;
  duration?: number;
  [k: string]: unknown;
}

/** Zeigt die agenda-relevanten Felder + alle weiteren Schlüssel eines Punkts. */
function dumpItem(it: RawItem): void {
  const known = ['id', 'title', 'type', 'start', 'isBeforeEvent', 'duration'];
  const extra = Object.keys(it).filter((k) => !known.includes(k));
  console.log(
    `  #${it.id} [${it.type}] „${String(it.title).slice(0, 28)}"  ` +
      `start=${JSON.stringify(it.start)}  isBeforeEvent=${it.isBeforeEvent}  duration=${it.duration}`,
  );
  console.log(`     weitere Felder: ${extra.join(', ') || '(keine)'}`);
}

async function loadAgendaItems(eventId: number): Promise<RawItem[]> {
  const ag = (await ctGet(`/api/events/${eventId}/agenda`)) as { data?: { items?: RawItem[] } };
  return ag.data?.items ?? [];
}

async function main(): Promise<void> {
  console.log(`Diagnose Agenda-„ausgeblendet" gegen ${BASE}\n`);
  await authenticate();

  // Events der nächsten ~6 Wochen abrufen und das/die Gottesdienste mit Agenda finden.
  const today = new Date().toISOString().slice(0, 10);
  const evResp = (await ctGet(`/api/events?from=${today}`)) as { data?: any[] };
  const events = evResp.data ?? [];
  console.log(`\nGefundene Events ab ${today}: ${events.length}`);

  // Für die ersten paar Events mit Agenda die Punkte dumpen.
  let shown = 0;
  for (const ev of events) {
    if (shown >= 3) break;
    let items: RawItem[];
    try {
      items = await loadAgendaItems(ev.id);
    } catch {
      continue; // kein Ablaufplan
    }
    if (items.length === 0) continue;
    shown++;
    console.log(
      `\n=== Event #${ev.id} „${ev.name}" (${ev.startDate}) – ${items.length} Punkte ===`,
    );
    for (const it of items) dumpItem(it);
  }

  // Vollen Rohdatensatz von zwei Punkten aus Event 773 zeigen: ausgeblendeter Soundcheck (#2512)
  // vs. normale Begrüßung (#2521) – um den Unterschied (startTimes/meta/@deprecated) zu finden.
  try {
    const items773 = await loadAgendaItems(773);
    for (const id of [2512, 2521]) {
      const it = items773.find((i) => i.id === id);
      if (it) {
        console.log(`\n>>> VOLLER DATENSATZ Punkt #${id} (Event 773):`);
        console.log(JSON.stringify(it, null, 2));
      }
    }
  } catch (e) {
    console.log(`(Detail-Dump fehlgeschlagen: ${(e as Error).message})`);
  }

  if (!DO_WRITES || !TEST_HIDE_ITEM) {
    console.log(
      '\n(Schreib-Test übersprungen. Zum Testen von hide/unhide:' +
        ' DO_WRITES=1 TEST_HIDE_ITEM=<itemId> TEST_EVENT_ID=<eventId> erneut aufrufen.)',
    );
    return;
  }

  // Schreib-Test an einem bereits ausgeblendeten Punkt: unhide → prüfen → hide → prüfen.
  // So bleibt der Originalzustand (ausgeblendet) am Ende erhalten. Geprüft wird startTimes[eventId].
  const eventId = Number(process.env.TEST_EVENT_ID);
  const st = (i?: RawItem) => JSON.stringify((i?.startTimes as Record<string, unknown>)?.[eventId]);
  const before = (await loadAgendaItems(eventId)).find((i) => i.id === TEST_HIDE_ITEM);
  console.log(`\n--- hide/unhide-Test an Punkt #${TEST_HIDE_ITEM} (Event ${eventId}) ---`);
  console.log(`vorher:      startTimes[${eventId}]=${st(before)}`);
  const unhideStatus = await ctPost(`/api/events/${eventId}/agenda/items/${TEST_HIDE_ITEM}/unhide`);
  const afterUnhide = (await loadAgendaItems(eventId)).find((i) => i.id === TEST_HIDE_ITEM);
  console.log(`POST /unhide → HTTP ${unhideStatus}  →  startTimes[${eventId}]=${st(afterUnhide)}`);
  const hideStatus = await ctPost(`/api/events/${eventId}/agenda/items/${TEST_HIDE_ITEM}/hide`);
  const afterHide = (await loadAgendaItems(eventId)).find((i) => i.id === TEST_HIDE_ITEM);
  console.log(`POST /hide   → HTTP ${hideStatus}  →  startTimes[${eventId}]=${st(afterHide)}`);
  console.log('(Endzustand = wieder ausgeblendet, wie vorher.)');
}

main().catch((e) => {
  console.error('\n✗ Abgebrochen:', e instanceof Error ? e.message : e);
  process.exit(1);
});
