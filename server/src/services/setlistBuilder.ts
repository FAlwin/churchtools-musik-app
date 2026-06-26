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
  SongVersion,
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

/**
 * Marker für von uns verwaltete, benannte Versionen: „<Titel> — <Name> (ECG).chordpro".
 * Das `(ECG)`-Kürzel erkennt unsere Dateien zuverlässig (kein Verwechseln mit Originaldateien,
 * die zufällig einen Bindestrich enthalten).
 */
const VERSION_TAG = '(ECG)';

/** Macht aus einem Versionsnamen einen stabilen Schlüssel (Slug). */
export function versionSlug(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Akzente entfernen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'version';
}

/**
 * Erkennt am Namen, ob eine Datei eine von uns verwaltete Version ist, und liefert deren Namen.
 * Neuer Marker „— <Name> (ECG).chordpro"; abwärtskompatibel „— Bearbeitet.chordpro" /
 * „— ECG.chordpro" (Bestandsdateien älterer Instanzen → Name „Bearbeitet").
 */
function versionNameOf(f: CtArrangementFile): string | null {
  const tagged = f.name.match(/[—-]\s*(.+?)\s*\(ECG\)\.chordpro$/i);
  if (tagged) return tagged[1].trim();
  if (/[—-]\s*(?:bearbeitet|ecg)\.chordpro$/i.test(f.name)) return 'Bearbeitet';
  return null;
}
function isVersionFile(f: CtArrangementFile): boolean {
  return versionNameOf(f) !== null;
}
function isOriginalChordpro(f: CtArrangementFile): boolean {
  return /\.chordpro$/i.test(f.name) && !isVersionFile(f);
}

/** Dateiname einer verwalteten Version aus Lied-Titel + Versionsname. */
function versionFileName(songName: string, versionName: string): string {
  const safeTitle = songName.replace(/[\\/:*?"<>|]/g, '').trim();
  const safeName = versionName.replace(/[\\/:*?"<>|()]/g, '').trim();
  return `${safeTitle} — ${safeName} ${VERSION_TAG}.chordpro`;
}

/** PDF/Bild-Dokumente eines Arrangements (für die Dokumentenanzeige). */
function documentsOf(files: CtArrangementFile[]): SongDocument[] {
  const out: SongDocument[] = [];
  for (const f of files) {
    const fileId = fileIdFromUrl(f.fileUrl);
    if (fileId === null) continue;
    if (/\.pdf$/i.test(f.name)) out.push({ fileId, name: f.name, type: 'pdf' });
    else if (/\.(jpe?g|png|gif|webp)$/i.test(f.name))
      out.push({ fileId, name: f.name, type: 'image' });
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
  const versionFiles = (arr?.files ?? []).filter(isVersionFile);

  const download = async (f?: CtArrangementFile): Promise<string> => {
    if (!f) return '';
    try {
      return await downloadFileText(cookie, f.fileUrl);
    } catch {
      return '';
    }
  };
  // Original + alle benannten Versionen parallel laden
  const [chordpro, ...versionTexts] = await Promise.all([
    download(originalFile),
    ...versionFiles.map((f) => download(f)),
  ]);
  const versions: SongVersion[] = versionFiles.map((f, i) => {
    const name = versionNameOf(f) ?? 'Version';
    return { key: versionSlug(name), name, text: versionTexts[i] ?? '' };
  });

  // Tonart/Takt aus dem Original ableiten (sonst erste Version, falls kein Original existiert)
  const source = chordpro || versions[0]?.text || '';
  const originalKey =
    metaValue(source, 'key') ?? arr?.keyOfArrangement ?? arr?.key ?? agendaSong.key ?? 'C';
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
    versions,
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

/** Lädt das Arrangement + listet die vorhandenen Versionen (mit Datei + Slug). */
async function loadArrangementVersions(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<{ songName: string; files: { file: CtArrangementFile; name: string; key: string }[] }> {
  const song = await getSong(cookie, songId);
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Arrangement nicht gefunden.');
  const files = arr.files
    .map((file) => {
      const name = versionNameOf(file);
      return name ? { file, name, key: versionSlug(name) } : null;
    })
    .filter((v): v is { file: CtArrangementFile; name: string; key: string } => v !== null);
  return { songName: song.name, files };
}

/** Legt eine neue benannte Version an (eigene .chordpro-Datei im Arrangement). */
export async function createVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, 'Bitte einen Versionsnamen angeben.');
  if (/^original$/i.test(trimmed)) throw new HttpError(400, '„Original" ist reserviert.');
  const key = versionSlug(trimmed);
  const { songName, files } = await loadArrangementVersions(cookie, songId, arrangementId);
  if (files.some((v) => v.key === key)) {
    throw new HttpError(409, `Es gibt bereits eine Version „${trimmed}".`);
  }
  await uploadChordpro(cookie, arrangementId, versionFileName(songName, trimmed), text);
  return { key, name: trimmed, text };
}

/** Aktualisiert Text und/oder Namen einer vorhandenen Version. */
export async function updateVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  versionKey: string,
  changes: { text?: string; name?: string },
): Promise<SongVersion> {
  const { songName, files } = await loadArrangementVersions(cookie, songId, arrangementId);
  const current = files.find((v) => v.key === versionKey);
  if (!current) throw new HttpError(404, 'Version nicht gefunden.');

  const newName = (changes.name ?? current.name).trim();
  if (!newName) throw new HttpError(400, 'Bitte einen Versionsnamen angeben.');
  if (/^original$/i.test(newName)) throw new HttpError(400, '„Original" ist reserviert.');
  const newKey = versionSlug(newName);
  if (newKey !== versionKey && files.some((v) => v.key === newKey)) {
    throw new HttpError(409, `Es gibt bereits eine Version „${newName}".`);
  }

  // Text bestimmen: neuer Text oder der bisherige Inhalt (bei reiner Umbenennung).
  const text = changes.text ?? (await downloadFileText(cookie, current.file.fileUrl));
  // Alte Datei entfernen, neue (ggf. umbenannt) hochladen.
  const id = fileIdFromUrl(current.file.fileUrl);
  if (id) await deleteFile(cookie, id);
  await uploadChordpro(cookie, arrangementId, versionFileName(songName, newName), text);
  return { key: newKey, name: newName, text };
}

/** Löscht eine benannte Version (das Original bleibt erhalten). */
export async function deleteVersion(
  cookie: string,
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<void> {
  const { files } = await loadArrangementVersions(cookie, songId, arrangementId);
  const current = files.find((v) => v.key === versionKey);
  if (!current) return;
  const id = fileIdFromUrl(current.file.fileUrl);
  if (id) await deleteFile(cookie, id);
}

/** Erkennt am ChurchTools-Typ, ob ein Agenda-Punkt eine Überschrift / ein Abschnitt ist. */
function isHeaderType(type?: string): boolean {
  return !!type && /header|überschrift|heading|section/i.test(type);
}

/** Formatiert eine CT-Startzeit (ISO/UTC) als deutsche Ortszeit „HH:MM"; null bei fehlender/ungültiger Zeit. */
function formatBerlinTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(d);
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
function responsibleEntries(item: {
  responsible?: { persons?: { service?: string; person?: { title?: string } }[] };
}): ResponsibleEntry[] {
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
async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
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
      const durationSec = item.duration ?? 0;
      // Uhrzeit MASSGEBLICH aus startTimes[eventId]: ist der Eintrag null, hat der Nutzer die
      // Uhrzeit in ChurchTools ausgeblendet (Auge) → keine Zeit anzeigen. Das Feld `start` bleibt
      // auch dann gefüllt und ist daher unbrauchbar. Fallback auf `start`, falls startTimes fehlt.
      const stEntry = item.startTimes ? item.startTimes[String(eventId)] : undefined;
      const timeSource = stEntry === undefined ? item.start : stEntry;
      return {
        id: item.id,
        title: item.title,
        type: item.type ?? null,
        isHeader: isHeaderType(item.type),
        responsible: responsibleEntries(item),
        responsibleText: item.responsible?.text ?? '',
        song,
        time: formatBerlinTime(timeSource),
        durationMin: durationSec > 0 ? Math.round(durationSec / 60) : null,
        note: item.note ?? '',
      };
    }),
  );
}
