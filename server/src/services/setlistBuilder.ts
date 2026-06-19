/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import type {
  AgendaItem,
  ResponsibleEntry,
  Service,
  SetlistSong,
  SongDocument,
  SongLibraryEntry,
} from '@shared/types/index';
import {
  getAgenda,
  getEvents,
  getAppointmentSubtitle,
  getSong,
  getAllSongs,
  downloadFileText,
  uploadChordpro,
  deleteFile,
  fileIdFromUrl,
  type CtAgendaSong,
} from './churchtools.js';
import type { CtArrangementFile, CtSong } from './churchtools.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mapEventToService } from '../utils/mapEvent.js';

/** Datei-Suffix-Marker für die bearbeitete Version (Original bleibt unangetastet). */
const EDITED_SUFFIX = 'Bearbeitet';

/**
 * Erkennt am Namen, ob eine Datei die bearbeitete Version ist.
 * Matcht den neuen Marker „— Bearbeitet.chordpro" UND – aus Abwärtskompatibilität –
 * den alten „— ECG.chordpro" (Bestandsdateien älterer Instanzen funktionieren weiter).
 */
function isEditedFile(f: CtArrangementFile): boolean {
  return /[—-]\s*(?:bearbeitet|ecg)\.chordpro$/i.test(f.name);
}
function isOriginalChordpro(f: CtArrangementFile): boolean {
  return /\.chordpro$/i.test(f.name) && !isEditedFile(f);
}

/** PDF/Bild-Dokumente eines Arrangements (für die Dokumentenanzeige). */
function documentsOf(files: CtArrangementFile[]): SongDocument[] {
  const out: SongDocument[] = [];
  for (const f of files) {
    const fileId = fileIdFromUrl(f.fileUrl);
    if (fileId === null) continue;
    if (/\.pdf$/i.test(f.name)) out.push({ fileId, name: f.name, type: 'pdf' });
    else if (/\.(jpe?g|png|gif|webp)$/i.test(f.name)) out.push({ fileId, name: f.name, type: 'image' });
  }
  return out;
}

/** Liest einen Metadaten-Wert aus ChordPro-Text ({key: E} → "E"). */
function metaValue(chordpro: string, key: string): string | null {
  const m = chordpro.match(new RegExp(`\\{${key}\\s*:\\s*([^}]+)\\}`, 'i'));
  return m ? m[1].trim() : null;
}

/** Gottesdienste im Zeitfenster, die einen Ablaufplan haben (mit Song-Anzahl). */
export async function getServicesWithSetlists(
  cookie: string,
  from: string,
  to: string,
): Promise<Service[]> {
  const events = await getEvents(cookie, from, to);
  // mapLimit liefert in Fertigstellungs-Reihenfolge → Start-Zeitpunkt (ISO inkl. Uhrzeit)
  // mitführen und am Ende danach sortieren (sonst stehen gleich-tägige Events falsch).
  const rows: { service: Service; start: string }[] = [];
  // Max. 8 Events gleichzeitig (je 2 CT-Abrufe) – schont die ChurchTools-API.
  await mapLimit(events, 8, async (ev) => {
    try {
      const calId = ev.calendar?.domainIdentifier;
      // Agenda + Termin-Untertitel parallel laden.
      const [agenda, subtitle] = await Promise.all([
        getAgenda(cookie, ev.id),
        calId && ev.appointmentId
          ? getAppointmentSubtitle(cookie, calId, ev.appointmentId)
          : Promise.resolve(null),
      ]);
      const songCount = (agenda.items ?? []).filter((i) => i.song).length;
      // Sichtbar, sobald ein Ablaufplan existiert – auch ohne Lieder.
      rows.push({ service: mapEventToService(ev, songCount, subtitle), start: ev.startDate });
    } catch {
      /* 404 = kein Ablaufplan */
    }
  });
  return rows.sort((a, b) => a.start.localeCompare(b.start)).map((r) => r.service);
}

/**
 * Baut einen einzelnen SetlistSong aus dem Agenda-Song-Eintrag (lädt Datei + Details).
 * `preloadedSong` vermeidet einen erneuten getSong-Abruf, wenn der Song schon vorliegt.
 */
async function buildSong(
  cookie: string,
  agendaSong: CtAgendaSong,
  preloadedSong?: CtSong,
): Promise<SetlistSong> {
  const song = preloadedSong ?? (await getSong(cookie, agendaSong.songId));
  const arr =
    song.arrangements.find((a) => a.id === agendaSong.arrangementId) ?? song.arrangements[0];

  const originalFile = arr?.files.find(isOriginalChordpro);
  const editedFile = arr?.files.find(isEditedFile);

  const download = async (f?: CtArrangementFile): Promise<string> => {
    if (!f) return '';
    try {
      return await downloadFileText(cookie, f.fileUrl);
    } catch {
      return '';
    }
  };
  // Original- und bearbeitete ChordPro parallel laden
  const [chordpro, chordproEdited] = await Promise.all([
    download(originalFile),
    editedFile ? download(editedFile) : Promise.resolve(null),
  ]);

  // Tonart/Takt aus der angezeigten Version ableiten (bearbeitet bevorzugt, sonst Original)
  const source = chordproEdited || chordpro;
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
    chordproEdited,
    documents: arr ? documentsOf(arr.files) : [],
  };
}

/** Findet die ChurchTools-fileUrl einer Datei (per Datei-ID) zum Durchreichen. */
export async function resolveFileUrl(
  cookie: string,
  songId: number,
  fileId: number,
): Promise<string> {
  const song = await getSong(cookie, songId);
  for (const arr of song.arrangements) {
    const f = arr.files.find((x) => fileIdFromUrl(x.fileUrl) === fileId);
    if (f) return f.fileUrl;
  }
  throw new HttpError(404, 'Datei nicht gefunden.');
}

/** Erzeugt/aktualisiert die bearbeitete Version eines Arrangements. */
export async function saveEditedChordpro(
  cookie: string,
  songId: number,
  arrangementId: number,
  text: string,
): Promise<void> {
  const song = await getSong(cookie, songId);
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');
  // vorhandene bearbeitete Datei zuerst entfernen (ersetzen) – matcht auch alte „— ECG"-Dateien
  const existing = arr.files.find(isEditedFile);
  if (existing) {
    const id = fileIdFromUrl(existing.fileUrl);
    if (id) await deleteFile(cookie, id);
  }
  const safeTitle = song.name.replace(/[\\/:*?"<>|]/g, '').trim();
  await uploadChordpro(cookie, arrangementId, `${safeTitle} — ${EDITED_SUFFIX}.chordpro`, text);
}

/** Löscht die bearbeitete Version (Zurücksetzen auf Original). */
export async function deleteEditedChordpro(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<void> {
  const song = await getSong(cookie, songId);
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');
  const existing = arr.files.find(isEditedFile);
  if (!existing) return;
  const id = fileIdFromUrl(existing.fileUrl);
  if (id) await deleteFile(cookie, id);
}

/** Erkennt am ChurchTools-Typ, ob ein Agenda-Punkt eine Überschrift / ein Abschnitt ist. */
function isHeaderType(type?: string): boolean {
  return !!type && /header|überschrift|heading|section/i.test(type);
}

/**
 * Säubert ein CT-Dienst-Token zum reinen Namen: entfernt alle eckigen Klammern und ein
 * etwaiges nachgestelltes „?" (CT-Offen-Marker). „[Kamera Studio]?" → „Kamera Studio".
 */
function cleanServiceName(service?: string): string {
  return (service ?? '')
    .replace(/[[\]]/g, '')
    .replace(/\?+\s*$/, '')
    .trim();
}

/**
 * Zuständige als Einträge, ohne Duplikate: für besetzte Plätze der Personenname (open=false),
 * für offene Dienst-Plätze (z.B. „[Musik]") der Dienstname (open=true).
 */
function responsibleEntries(
  item: { responsible?: { persons?: { service?: string; person?: { title?: string } }[] } },
): ResponsibleEntry[] {
  const entries: ResponsibleEntry[] = [];
  const seen = new Set<string>();
  for (const p of item.responsible?.persons ?? []) {
    const name = p.person?.title?.trim();
    const label = name || cleanServiceName(p.service);
    if (!label) continue;
    const open = !name;
    const key = `${label}|${open}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ label, open });
  }
  return entries;
}

interface SongUsage {
  count: number;
  lastUsed: string;
}

// Org-weite Song-Nutzung (gleich für alle) – im Speicher gecacht (TTL 1 h).
let usageCache: { at: number; data: Record<number, SongUsage> } | null = null;

/** Leert den Statistik-Cache – nach Ablauf-Änderungen aufrufen, damit Zahlen/Daten frisch sind. */
export function invalidateSongUsageCache(): void {
  usageCache = null;
}

/** Führt `fn` über alle Items aus, aber maximal `limit` gleichzeitig (schont die CT-API). */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/**
 * Zählt Song-Vorkommen in den Abläufen der letzten 12 Monate UND der kommenden 3 Monate
 * (gecacht). So zählen eingeplante Lieder mit; `lastUsed` ist das jeweils späteste Datum –
 * liegt also in der Zukunft, wenn das Lied demnächst eingeplant ist.
 */
export async function getSongUsageMap(cookie: string): Promise<Record<number, SongUsage>> {
  if (usageCache && Date.now() - usageCache.at < 3_600_000) return usageCache.data;
  const today = new Date();
  const toD = new Date(today);
  toD.setMonth(toD.getMonth() + 3);
  const to = toD.toISOString().slice(0, 10);
  const fromD = new Date(today);
  fromD.setFullYear(fromD.getFullYear() - 1);
  const from = fromD.toISOString().slice(0, 10);

  const events = await getEvents(cookie, from, to);
  const usage: Record<number, SongUsage> = {};
  await mapLimit(events, 8, async (ev) => {
    try {
      const agenda = await getAgenda(cookie, ev.id);
      const date = ev.startDate.slice(0, 10);
      for (const it of agenda.items ?? []) {
        const id = it.song?.songId;
        if (!id) continue;
        const cur = usage[id];
        if (!cur) usage[id] = { count: 1, lastUsed: date };
        else {
          cur.count += 1;
          if (date > cur.lastUsed) cur.lastUsed = date;
        }
      }
    } catch {
      /* 404 = kein Ablauf */
    }
  });
  usageCache = { at: Date.now(), data: usage };
  return usage;
}

/** Liefert alle Lieder (Standard-Arrangement), alphabetisch. Statistik wird separat geladen. */
export async function getSongLibrary(cookie: string): Promise<SongLibraryEntry[]> {
  const songs = await getAllSongs(cookie);
  return songs
    .map((s) => {
      const arr = s.arrangements.find((a) => a.isDefault) ?? s.arrangements[0];
      if (!arr) return null;
      return {
        songId: s.id,
        name: s.name,
        author: s.author ?? null,
        key: arr.keyOfArrangement ?? arr.key ?? null,
        arrangementId: arr.id,
      } as SongLibraryEntry;
    })
    .filter((e): e is SongLibraryEntry => e !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Baut die Chart-Daten eines einzelnen Lieds (für die „Alle Lieder"-Ansicht). */
export async function getSongChart(
  cookie: string,
  songId: number,
  arrangementId?: number,
): Promise<SetlistSong> {
  const song = await getSong(cookie, songId);
  const arr =
    (arrangementId && song.arrangements.find((a) => a.id === arrangementId)) ||
    song.arrangements.find((a) => a.isDefault) ||
    song.arrangements[0];
  if (!arr) throw new HttpError(404, 'Kein Arrangement für dieses Lied gefunden.');
  // `song` direkt durchreichen → kein zweiter getSong-Abruf in buildSong.
  return buildSong(
    cookie,
    {
      songId,
      arrangementId: arr.id,
      title: song.name,
      arrangement: arr.name,
      key: arr.keyOfArrangement ?? arr.key ?? null,
      bpm: arr.bpm ?? null,
    },
    song,
  );
}

/** Alle Punkte eines Ablaufplans in Reihenfolge – Lieder aufgelöst, übrige nur als Eintrag. */
export async function getAgendaItems(cookie: string, eventId: number): Promise<AgendaItem[]> {
  const agenda = await getAgenda(cookie, eventId);
  const items = agenda.items ?? [];
  return Promise.all(
    items.map(async (item): Promise<AgendaItem> => {
      const song = item.song ? await buildSong(cookie, item.song) : null;
      return {
        id: item.id,
        title: item.title,
        type: item.type ?? null,
        isHeader: isHeaderType(item.type),
        responsible: responsibleEntries(item),
        responsibleText: item.responsible?.text ?? '',
        song,
      };
    }),
  );
}
