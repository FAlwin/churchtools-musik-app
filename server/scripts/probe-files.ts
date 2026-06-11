/**
 * Zweite Erkundung: echte Dateiinhalte (.txt / .sng) eines Arrangements ansehen
 * und ein Event mit Ablaufplan (Agenda) finden – inkl. der per-Event-Tonart.
 *
 * Aufruf:  npx tsx server/scripts/probe-files.ts
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

const authHeaders = { Authorization: `Login ${TOKEN}`, Accept: 'application/json' };

async function ctJson(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} bei ${path}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Authorization: `Login ${TOKEN}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  // ── 1) Dateien des ersten Songs herunterladen und Inhalt zeigen ──
  const songs = await ctJson('/api/songs?limit=1');
  const song = songs.data?.[0];
  const arr = song?.arrangements?.[0];
  console.log(`Song: "${song?.name}" · Arrangement "${arr?.name}" · key=${arr?.key} · bpm=${arr?.bpm}`);
  console.log(`Dateien: ${(arr?.files ?? []).map((f: any) => f.name).join(', ')}`);

  for (const f of arr?.files ?? []) {
    if (/\.(txt|sng|chordpro|cho)$/i.test(f.name)) {
      console.log(`\n========== DATEI: ${f.name} ==========`);
      try {
        const txt = await fetchText(f.fileUrl);
        console.log(txt.slice(0, 1600));
        if (txt.length > 1600) console.log(`…[${txt.length} Zeichen gesamt, gekürzt]`);
      } catch (e) {
        console.log(`(Download fehlgeschlagen: ${(e as Error).message})`);
      }
    }
  }

  // ── 2) Event mit Agenda finden ──
  console.log('\n\n########## SUCHE EVENT MIT AGENDA ##########');
  const events = await ctJson('/api/events');
  const list = (events.data ?? []) as any[];
  let found = false;
  for (const ev of list.slice(0, 12)) {
    try {
      const agenda = await ctJson(`/api/events/${ev.id}/agenda`);
      const ag = agenda.data ?? agenda;
      const items = (ag.items ?? []) as any[];
      const songItems = items.filter((i) => i.song || /song/i.test(String(i.type ?? '')));
      console.log(`✓ Event ${ev.id} "${ev.name}" (${ev.startDate}): Agenda mit ${items.length} Items, ${songItems.length} Songs`);
      if (songItems.length && !found) {
        found = true;
        console.log('\n=== AGENDA-ITEM (Song) – Felder ===');
        console.log(Object.keys(songItems[0]));
        console.log('\n=== AGENDA-ITEM (Song) – Inhalt ===');
        console.log(
          JSON.stringify(
            songItems[0],
            (_k, v) => (typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v),
            2,
          ).slice(0, 2000),
        );
      }
    } catch {
      // 404 = kein Ablaufplan für dieses Event
    }
  }
  if (!found) console.log('Kein Event mit Song-Agenda in den ersten 12 gefunden.');

  console.log('\n✓ Probe fertig.');
}

main().catch((e) => {
  console.error(`\n✗ Fehler: ${(e as Error).message}`);
  process.exit(1);
});
