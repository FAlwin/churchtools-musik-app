/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import type { Service, SetlistSong } from '@shared/types/index';
import {
  getAgenda,
  getEvents,
  getSong,
  downloadFileText,
  type CtAgendaSong,
} from './churchtools.js';
import { mapEventToService } from '../utils/mapEvent.js';

/** Liest einen Metadaten-Wert aus ChordPro-Text ({key: E} → "E"). */
function metaValue(chordpro: string, key: string): string | null {
  const m = chordpro.match(new RegExp(`\\{${key}\\s*:\\s*([^}]+)\\}`, 'i'));
  return m ? m[1].trim() : null;
}

/** Gottesdienste im Zeitfenster, die eine Setlist haben (mit Song-Anzahl). */
export async function getServicesWithSetlists(
  cookie: string,
  from: string,
  to: string,
): Promise<Service[]> {
  const events = await getEvents(cookie, from, to);
  const withCounts = await Promise.all(
    events.map(async (ev) => {
      try {
        const agenda = await getAgenda(cookie, ev.id);
        const songCount = (agenda.items ?? []).filter((i) => i.song).length;
        return songCount > 0 ? mapEventToService(ev, songCount) : null;
      } catch {
        return null; // 404 = kein Ablaufplan
      }
    }),
  );
  return withCounts.filter((s): s is Service => s !== null).sort((a, b) => a.date.localeCompare(b.date));
}

/** Baut einen einzelnen SetlistSong aus dem Agenda-Song-Eintrag (lädt Datei + Details). */
async function buildSong(cookie: string, agendaSong: CtAgendaSong): Promise<SetlistSong> {
  const song = await getSong(cookie, agendaSong.songId);
  const arr =
    song.arrangements.find((a) => a.id === agendaSong.arrangementId) ?? song.arrangements[0];

  const chordproFile = arr?.files.find((f) => /\.chordpro$/i.test(f.name));
  let chordpro = '';
  if (chordproFile) {
    try {
      chordpro = await downloadFileText(cookie, chordproFile.fileUrl);
    } catch {
      chordpro = '';
    }
  }

  const originalKey =
    metaValue(chordpro, 'key') ?? arr?.keyOfArrangement ?? arr?.key ?? agendaSong.key ?? 'C';
  const targetKey = agendaSong.key ?? arr?.key ?? originalKey;
  const timeSig = metaValue(chordpro, 'time') ?? arr?.beat ?? null;

  return {
    id: agendaSong.songId,
    arrangementId: agendaSong.arrangementId,
    title: agendaSong.title || song.name,
    author: song.author ?? '',
    originalKey,
    targetKey,
    bpm: agendaSong.bpm ?? arr?.bpm ?? null,
    timeSig,
    ccli: song.ccli ?? null,
    chordpro,
  };
}

/** Alle Songs einer Setlist (in Agenda-Reihenfolge). */
export async function getSetlistSongs(cookie: string, eventId: number): Promise<SetlistSong[]> {
  const agenda = await getAgenda(cookie, eventId);
  const songItems = (agenda.items ?? [])
    .filter((i) => i.song)
    .map((i) => i.song as CtAgendaSong);
  return Promise.all(songItems.map((s) => buildSong(cookie, s)));
}
