/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import type {
  AgendaItem,
  Service,
  SetlistSong,
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
import {
  versionSlug,
  versionNameOf,
  versionFileName,
  isVersionFile,
  isOriginalChordpro,
  documentsOf,
} from './arrangementFiles.js';
import { metaValue } from './chordproMeta.js';
import { setlistFingerprint, agendaSignatureList, diffAgendaItems } from './agendaDiff.js';
import { isHeaderType, formatBerlinTime, responsibleEntries } from './agendaFormat.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mapEventToService } from '../utils/mapEvent.js';

/**
 * Beim Sammeln über viele Termine ist ein fehlender Ablaufplan (404) normal und wird still
 * übersprungen. Ein anderer Fehler (CT-500, Netz-Aussetzer) darf NICHT unbemerkt Termine aus der
 * Liste/Statistik fallen lassen – daher einmal pro Vorkommen warnen.
 */
function skipMissingAgenda(context: string, e: unknown): void {
  if (e instanceof HttpError && e.status === 404) return; // kein Ablaufplan – erwartet
  console.warn(`${context}: Ablauf-Abruf fehlgeschlagen (Termin übersprungen):`, e);
}

/**
 * Marker für von uns verwaltete, benannte Versionen: „<Titel> — <Name> (App).chordpro".
 * Das `(App)`-Kürzel erkennt unsere Dateien zuverlässig (kein Verwechseln mit Originaldateien,
 * die zufällig einen Bindestrich enthalten) und ist – anders als das frühere `(ECG)` – nicht
 * gemeindespezifisch. Alt-Bestand mit `(ECG)` wird weiterhin erkannt (siehe versionNameOf).
 */
/** Fingerabdruck der aktuellen Setlist eines Termins (leichter Abruf, ohne ChordPro zu laden). */
export async function getSetlistFingerprint(cookie: string, eventId: number): Promise<string> {
  const agenda = await getAgenda(cookie, eventId);
  return setlistFingerprint(agenda.items ?? []);
}

/** Fingerabdruck + Signatur je Punkt in einem Abruf – für das „gesehen"-Merken (#143/#161). */
export async function getSetlistState(
  cookie: string,
  eventId: number,
): Promise<{ hash: string; items: { id: number; sig: string }[] }> {
  const agenda = await getAgenda(cookie, eventId);
  const items = agenda.items ?? [];
  return { hash: setlistFingerprint(items), items: agendaSignatureList(items) };
}

/**
 * Gottesdienste im Zeitfenster, die einen Ablaufplan haben (mit Song-Anzahl). Liefert je Termin
 * zusätzlich den Setlist-Fingerabdruck (#143), damit der Controller das „geändert"-Badge je Konto
 * bestimmen kann.
 */
export async function getServicesWithSetlists(
  cookie: string,
  from: string,
  to: string,
): Promise<{ service: Service; hash: string }[]> {
  const events = await getEvents(cookie, from, to);
  // mapLimit liefert in Fertigstellungs-Reihenfolge → Start-Zeitpunkt (ISO inkl. Uhrzeit)
  // mitführen und am Ende danach sortieren (sonst stehen gleich-tägige Events falsch).
  const rows: { service: Service; hash: string; start: string }[] = [];
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
      const items = agenda.items ?? [];
      const songCount = items.filter((i) => i.song).length;
      // Sichtbar, sobald ein Ablaufplan existiert – auch ohne Lieder.
      rows.push({
        service: mapEventToService(ev, songCount, subtitle),
        hash: setlistFingerprint(items),
        start: ev.startDate,
      });
    } catch (e) {
      skipMissingAgenda('getServicesWithSetlist', e);
    }
  });
  return rows
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((r) => ({ service: r.service, hash: r.hash }));
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

  /**
   * Lädt eine Akkord-Datei und sagt, OB der Fehlschlag vorübergehend war (#274).
   *
   * Vorher gab jeder Fehler schlicht `''` zurück – eine Zeitüberschreitung wurde damit zu einem
   * **leeren Lied**: leeres Blatt ohne ein Wort, und in der Sammel-PDF fiel das Lied ganz heraus
   * (`Setlist.tsx` filtert leere Texte). Ein Absturz des ganzen Ablaufs wäre die falsche Antwort –
   * dann sähe man auch die anderen Lieder nicht. Deshalb wird der Fehlschlag am Lied vermerkt.
   *
   * `404` zählt NICHT als Fehlschlag: Dann ist die Datei in ChurchTools wirklich weg und leer ist
   * die Wahrheit (`fileDownloadError` unterscheidet das seit #274).
   */
  const download = async (f?: CtArrangementFile): Promise<{ text: string; failed: boolean }> => {
    if (!f) return { text: '', failed: false };
    try {
      return { text: await downloadFileText(cookie, f.fileUrl), failed: false };
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return { text: '', failed: false };
      console.warn(
        `[setlist] Akkord-Datei von Lied ${agendaSong.songId} nicht ladbar:`,
        e instanceof Error ? e.message : e,
      );
      return { text: '', failed: true };
    }
  };
  // Original + alle benannten Versionen parallel laden
  const [original, ...versionResults] = await Promise.all([
    download(originalFile),
    ...versionFiles.map((f) => download(f)),
  ]);
  const chordpro = original.text;
  const chordproFailed = original.failed || versionResults.some((r) => r.failed);
  const versions: SongVersion[] = versionFiles.map((f, i) => {
    const name = versionNameOf(f) ?? 'Version';
    return { key: versionSlug(name), name, text: versionResults[i]?.text ?? '' };
  });

  // Kopfangaben aus dem Original ableiten (sonst erste Version, falls kein Original existiert)
  const source = chordpro || versions[0]?.text || '';
  const originalKey =
    metaValue(source, 'key') ?? arr?.keyOfArrangement ?? arr?.key ?? agendaSong.key ?? 'C';
  const targetKey = agendaSong.key ?? arr?.key ?? originalKey;
  const timeSig = metaValue(source, 'time') ?? arr?.beat ?? null;

  return {
    id: agendaSong.songId,
    arrangementId: agendaSong.arrangementId,
    // `{title}`/`{artist}` aus der Datei gehen vor – genau wie Tonart und Taktart darüber (#236).
    // Wirkt damit in Kopfzeile, Ablaufplan, Blatt und PDF. Die Bibliothek „Alle Lieder" bleibt
    // beim ChurchTools-Namen: `getSongLibrary` hat keinen ChordPro-Text (siehe Kommentar dort).
    title: metaValue(source, 'title') ?? (agendaSong.title || song.name),
    author: metaValue(source, 'artist') ?? song.author ?? '',
    originalKey,
    targetKey,
    bpm: agendaSong.bpm ?? arr?.bpm ?? null,
    timeSig,
    ccli: song.ccli ?? null,
    chordpro,
    // Nur setzen, wenn wirklich etwas schiefging – so bleibt die Antwort für den Normalfall gleich.
    ...(chordproFailed ? { chordproFailed: true } : {}),
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

interface SongUsage {
  /** Vergangene Spieltermine (YYYY-MM-DD), absteigend sortiert (neuester zuerst). */
  dates: string[];
}

// Org-weite Song-Nutzung (gleich für alle) – im Speicher gecacht (TTL 1 h).
// Bewusst mit dem Cookie des ERSTEN Anfragenden im TTL-Fenster aufgebaut: Die Statistik ist
// organisationsweit identisch, und der Inhalt (nur Lied-Spieldaten, keine Titel/Notizen) ist
// unkritisch. CT-Sichtbarkeitsunterschiede zwischen Konten werden hier bewusst eingeebnet.
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

/** Wie viele Jahre zurück Spieltermine gesammelt werden – deckt den „Alle"-Zeitfilter ab. */
const USAGE_LOOKBACK_YEARS = 4;

/**
 * Sammelt je Lied die vergangenen Spieltermine aus den Abläufen der letzten
 * `USAGE_LOOKBACK_YEARS` Jahre – bis heute (geplante Zukunftstermine zählen NICHT als „gespielt").
 * Org-weit gleich, 1 h gecacht. Häufigkeit und „zuletzt gespielt" für einen frei gewählten Zeitraum
 * rechnet der Client selbst aus dieser Terminliste – ohne erneuten Server-Roundtrip.
 */
export async function getSongUsageMap(cookie: string): Promise<Record<number, SongUsage>> {
  if (usageCache && Date.now() - usageCache.at < 3_600_000) return usageCache.data;
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromD = new Date(today);
  fromD.setFullYear(fromD.getFullYear() - USAGE_LOOKBACK_YEARS);
  const from = fromD.toISOString().slice(0, 10);

  const events = await getEvents(cookie, from, to);
  const usage: Record<number, SongUsage> = {};
  await mapLimit(events, 8, async (ev) => {
    try {
      const date = ev.startDate.slice(0, 10);
      if (date > to) return; // Sicherheitsnetz: keine Zukunftstermine mitzählen
      const agenda = await getAgenda(cookie, ev.id);
      for (const it of agenda.items ?? []) {
        const id = it.song?.songId;
        if (!id) continue;
        (usage[id] ??= { dates: [] }).dates.push(date);
      }
    } catch (e) {
      skipMissingAgenda('getSongUsageMap', e);
    }
  });
  // Termine je Lied absteigend sortieren (neuester zuerst) → Client nimmt [0] als „zuletzt".
  for (const u of Object.values(usage)) u.dates.sort((a, b) => b.localeCompare(a));
  usageCache = { at: Date.now(), data: usage };
  return usage;
}

/**
 * Liefert alle Lieder (Standard-Arrangement), alphabetisch. Statistik wird separat geladen.
 *
 * Bewusst der **ChurchTools-Name**, nicht `{title}` aus der Datei (#236): Hier liegt kein
 * ChordPro-Text vor, und ihn zu beschaffen hieße, beim Öffnen der Liste jede Lieddatei einzeln
 * herunterzuladen. In Ablaufplan, Kopfzeile und auf dem Blatt gilt dagegen `{title}`.
 */
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
      };
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

/**
 * Alle Punkte eines Ablaufplans in Reihenfolge – Lieder aufgelöst, übrige nur als Eintrag.
 * `prevSigs` (zuletzt gesehener Stand, #161): ist es gesetzt, bekommt jeder geänderte/neue/
 * verschobene Punkt `changed: true` – die Grundlage fürs Aufleuchten im Client.
 */
export async function getAgendaItems(
  cookie: string,
  eventId: number,
  prevSigs?: { id: number; sig: string; title?: string }[],
): Promise<AgendaItem[]> {
  const agenda = await getAgenda(cookie, eventId);
  const items = agenda.items ?? [];
  const diff = prevSigs ? diffAgendaItems(prevSigs, agendaSignatureList(items)) : null;
  const changedIds = diff ? new Set(diff.changedIds) : null;
  const built = await Promise.all(
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
        changed: changedIds ? changedIds.has(item.id) : undefined,
      };
    }),
  );
  // Entfernte Punkte (Etappe B) als Platzhalter an ihrer alten Position einblenden – der Client
  // lässt sie auflösen. Ohne Diff (nie gesehen) gibt es keine.
  if (!diff || diff.removed.length === 0) return built;
  const result = [...built];
  for (const r of diff.removed) {
    const placeholder: AgendaItem = {
      id: r.id,
      title: r.title,
      type: null,
      isHeader: false,
      responsible: [],
      responsibleText: '',
      song: null,
      time: null,
      durationMin: null,
      note: '',
      removed: true,
    };
    const at = r.afterId == null ? 0 : result.findIndex((it) => it.id === r.afterId) + 1;
    result.splice(at, 0, placeholder);
  }
  return result;
}
