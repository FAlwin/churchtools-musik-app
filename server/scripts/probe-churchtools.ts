/**
 * Einmaliges Erkundungs-Skript für die ChurchTools-API.
 * Liest CHURCHTOOLS_BASE_URL und CHURCHTOOLS_LOGIN_TOKEN aus der .env im Projektstamm
 * und gibt die Struktur der für uns relevanten Endpunkte aus – damit wir Schritt 7
 * (Proxy + Mapping) passgenau bauen können.
 *
 * Aufruf:  npx tsx server/scripts/probe-churchtools.ts
 *
 * Der Token wird NUR lesend verwendet und nie ausgegeben.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

async function ct(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} bei ${path}`);
  }
  return res.json();
}

/** Gibt ein Objekt kompakt aus (Strings gekürzt, damit ChordPro nicht alles flutet). */
function show(label: string, data: unknown, maxLen = 1400): void {
  const json = JSON.stringify(
    data,
    (_k, v) => (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…[gekürzt]' : v),
    2,
  );
  console.log(`\n=== ${label} ===`);
  console.log(json.length > maxLen ? json.slice(0, maxLen) + '\n…[Ausgabe gekürzt]' : json);
}

/** Listet nur die Schlüssel eines Objekts (für schnellen Überblick). */
function keysOf(data: unknown): string[] {
  if (data && typeof data === 'object' && !Array.isArray(data)) return Object.keys(data as object);
  return [];
}

async function main() {
  console.log(`ChurchTools-Probe gegen ${BASE}\n`);

  // 1) Wer bin ich?
  const whoami = (await ct('/api/whoami')) as { data?: Record<string, unknown> };
  const me = whoami.data ?? whoami;
  console.log(`Angemeldet als: ${(me as any).firstName ?? '?'} ${(me as any).lastName ?? ''} (id ${(me as any).id})`);

  // 2) Kommende Gottesdienste
  const events = (await ct('/api/events')) as { data?: unknown[] };
  const eventList = (events.data ?? []) as Array<Record<string, unknown>>;
  console.log(`\nGefundene Events: ${eventList.length}`);
  show('EVENT [0] – Felder', keysOf(eventList[0]));
  show('EVENT [0] – Inhalt', eventList[0]);

  // 3) Agenda des ersten Events (falls vorhanden)
  const firstId = eventList[0]?.id;
  if (firstId !== undefined) {
    try {
      const agenda = (await ct(`/api/events/${firstId}/agenda`)) as { data?: Record<string, unknown> };
      const ag = agenda.data ?? agenda;
      show('AGENDA – Felder', keysOf(ag));
      const items = ((ag as any).items ?? []) as Array<Record<string, unknown>>;
      console.log(`\nAgenda-Items: ${items.length}`);
      const songItem = items.find((i) => i.song || (i.type && String(i.type).includes('song')));
      show('AGENDA-ITEM mit Song', songItem ?? items[0]);
    } catch (e) {
      console.log(`\n(Agenda nicht abrufbar: ${(e as Error).message})`);
    }
  }

  // 4) Songs + Arrangements + Tonart-Feld + Dateien
  const songs = (await ct('/api/songs?limit=3')) as { data?: unknown[] };
  const songList = (songs.data ?? []) as Array<Record<string, unknown>>;
  console.log(`\nSongs gefunden (limit 3): ${songList.length}`);
  show('SONG [0] – Felder', keysOf(songList[0]));
  show('SONG [0] – Inhalt', songList[0], 2000);
  const arrangements = (songList[0]?.arrangements ?? []) as Array<Record<string, unknown>>;
  if (arrangements.length) {
    show('ARRANGEMENT [0] – Felder', keysOf(arrangements[0]));
    show('ARRANGEMENT [0] – Inhalt (Tonart + Dateien beachten)', arrangements[0], 2000);
  }

  console.log('\n✓ Probe fertig.');
}

main().catch((e) => {
  console.error(`\n✗ Fehler: ${(e as Error).message}`);
  process.exit(1);
});
