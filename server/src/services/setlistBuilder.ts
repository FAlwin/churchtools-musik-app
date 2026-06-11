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
  uploadChordpro,
  deleteFile,
  fileIdFromUrl,
  type CtAgendaSong,
  type CtArrangementFile,
} from './churchtools.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mapEventToService } from '../utils/mapEvent.js';

/** Erkennt, ob eine Datei die bearbeitete ECG-Version ist (am Namen). */
function isEcgFile(f: CtArrangementFile): boolean {
  return /ecg/i.test(f.name) && /\.chordpro$/i.test(f.name);
}
function isOriginalChordpro(f: CtArrangementFile): boolean {
  return /\.chordpro$/i.test(f.name) && !isEcgFile(f);
}

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

  const originalFile = arr?.files.find(isOriginalChordpro);
  const ecgFile = arr?.files.find(isEcgFile);

  const download = async (f?: CtArrangementFile): Promise<string> => {
    if (!f) return '';
    try {
      return await downloadFileText(cookie, f.fileUrl);
    } catch {
      return '';
    }
  };
  const chordpro = await download(originalFile);
  const chordproEcg = ecgFile ? await download(ecgFile) : null;

  // Tonart/Takt aus der angezeigten Version ableiten (ECG bevorzugt, sonst Original)
  const source = chordproEcg || chordpro;
  const originalKey = metaValue(source, 'key') ?? arr?.keyOfArrangement ?? arr?.key ?? agendaSong.key ?? 'C';
  const targetKey = agendaSong.key ?? arr?.key ?? originalKey;
  const timeSig = metaValue(source, 'time') ?? arr?.beat ?? null;

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
    chordproEcg,
  };
}

/** Erzeugt/aktualisiert die bearbeitete ECG-Version eines Arrangements. */
export async function saveEcgChordpro(
  cookie: string,
  songId: number,
  arrangementId: number,
  text: string,
): Promise<void> {
  const song = await getSong(cookie, songId);
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');
  // vorhandene ECG-Datei zuerst entfernen (ersetzen)
  const existing = arr.files.find(isEcgFile);
  if (existing) {
    const id = fileIdFromUrl(existing.fileUrl);
    if (id) await deleteFile(cookie, id);
  }
  const safeTitle = song.name.replace(/[\\/:*?"<>|]/g, '').trim();
  await uploadChordpro(cookie, arrangementId, `${safeTitle} — ECG.chordpro`, text);
}

/** Löscht die ECG-Version (Zurücksetzen auf Original). */
export async function deleteEcgChordpro(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<void> {
  const song = await getSong(cookie, songId);
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');
  const existing = arr.files.find(isEcgFile);
  if (!existing) return;
  const id = fileIdFromUrl(existing.fileUrl);
  if (id) await deleteFile(cookie, id);
}

/** Alle Songs einer Setlist (in Agenda-Reihenfolge). */
export async function getSetlistSongs(cookie: string, eventId: number): Promise<SetlistSong[]> {
  const agenda = await getAgenda(cookie, eventId);
  const songItems = (agenda.items ?? [])
    .filter((i) => i.song)
    .map((i) => i.song as CtAgendaSong);
  return Promise.all(songItems.map((s) => buildSong(cookie, s)));
}
