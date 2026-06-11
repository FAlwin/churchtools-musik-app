/**
 * Testet die Setlist-Pipeline (churchtools.ts + setlistBuilder.ts) gegen die echte
 * Instanz. Baut die Session über den Login-Token auf (statt Passwort-Login) und ruft
 * dieselben Funktionen auf, die das Backend im Betrieb nutzt.
 *
 * Aufruf:  npx tsx server/scripts/test-pipeline.ts
 */
import 'dotenv/config';
import { getServicesWithSetlists, getSetlistSongs } from '../src/services/setlistBuilder.js';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

async function sessionFromToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${TOKEN}`);
  const setCookie =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''];
  for (const c of setCookie) {
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) return m[1];
  }
  throw new Error('Kein Session-Cookie erhalten');
}

async function main() {
  const cookie = await sessionFromToken();

  console.log('=== Gottesdienste mit Setlist ===');
  const services = await getServicesWithSetlists(cookie, '2026-05-01', '2026-07-10');
  for (const s of services) {
    console.log(`  [${s.id}] ${s.weekday} ${s.day}. ${s.month} · ${s.name} · ${s.songCount} Songs · ${s.location}`);
  }
  if (!services.length) {
    console.log('  (keine)');
    return;
  }

  const target = services[0];
  console.log(`\n=== Setlist von Event ${target.id} (${target.name}) ===`);
  const songs = await getSetlistSongs(cookie, target.id);
  for (const song of songs) {
    const transp = song.originalKey === song.targetKey ? song.originalKey : `${song.originalKey}→${song.targetKey}`;
    console.log(
      `  • ${song.title} | Tonart ${transp} | bpm ${song.bpm ?? '-'} | ChordPro ${song.chordpro.length} Zeichen | CCLI ${song.ccli ?? '-'}`,
    );
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
