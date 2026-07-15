/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import { createHash } from 'node:crypto';
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
import type { CtArrangementFile, CtSong, CtAgendaItem } from './churchtools.js';
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
const VERSION_TAG = '(App)';

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
 * Aktueller Marker „— <Name> (App).chordpro"; abwärtskompatibel:
 *  - „— <Name> (ECG).chordpro" (Bestandsdateien mit dem früheren, gemeindespezifischen Kürzel)
 *  - „— Bearbeitet.chordpro" / „— ECG.chordpro" (ganz alte namenlose Varianten → Name „Bearbeitet").
 */
export function versionNameOf(f: CtArrangementFile): string | null {
  const tagged = f.name.match(/[—-]\s*(.+?)\s*\((?:App|ECG)\)\.chordpro$/i);
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
export function versionFileName(songName: string, versionName: string): string {
  const safeTitle = songName.replace(/[\\/:*?"<>|]/g, '').trim();
  const safeName = versionName.replace(/[\\/:*?"<>|()]/g, '').trim();
  return `${safeTitle} — ${safeName} ${VERSION_TAG}.chordpro`;
}

/** PDF/Bild-Dokumente eines Arrangements (für die Dokumentenanzeige). */
export function documentsOf(files: CtArrangementFile[]): SongDocument[] {
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
export function metaValue(chordpro: string, key: string): string | null {
  const m = chordpro.match(new RegExp(`\\{${key}\\s*:\\s*([^}]+)\\}`, 'i'));
  return m ? m[1].trim() : null;
}

/**
 * Fingerabdruck einer Setlist (#143): stabile Signatur aus Lied, Arrangement, Tonart UND
 * Reihenfolge der Lied-Punkte. Ändert sich eines davon (Lied neu/raus, umsortiert, Tonart),
 * ändert sich der Fingerabdruck. Nicht-Lieder (Überschriften, Begrüßung …) zählen bewusst nicht.
 * Rein & testbar; muss auf denselben Roh-Agenda-Daten laufen wie beim „gesehen"-Merken.
 */
/**
 * Inhalts-Signatur EINES Ablaufpunkts (#143/#161) – OHNE die id (die ist der Schlüssel). Erfasst
 * Titel, Typ, Lied+Arrangement+Tonart, Verantwortliche, Dauer, Notiz. Änderungen daran = Punkt
 * inhaltlich geändert.
 */
export function agendaItemSignature(i: CtAgendaItem): string {
  const song = i.song ? `${i.song.songId}:${i.song.arrangementId}:${i.song.key ?? ''}` : '';
  const resp = i.responsible?.text ?? '';
  return `${i.title}#${i.type ?? ''}#${song}#${resp}#${i.duration ?? ''}#${i.note ?? ''}`;
}

export function setlistFingerprint(items: CtAgendaItem[]): string {
  // „Struktur + Details" (#143): jede Ablaufänderung schlägt an – Reihenfolge (Array-Position),
  // Punkte hinzu/raus/umbenannt, Lied/Tonart, Verantwortliche, Dauer, Notiz.
  // Als sha256-Digest, NICHT als Klartext: der Wert geht per /setlist/version an jeden Client
  // (inkl. 5-s-Memo über Konten hinweg) – Titel/Notizen/Verantwortliche dürfen darin nicht
  // ablesbar sein. Verglichen wird ohnehin nur auf Gleichheit.
  if (items.length === 0) return '';
  const raw = items.map((i) => `${i.id}#${agendaItemSignature(i)}`).join('|');
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Geordnete Liste je Punkt (id + Inhalts-Signatur + Titel) – Basis für den „gesehen"-Vergleich
 * (#161). Der Titel wird für die „aufgelöst"-Anzeige entfernter Punkte mitgeführt (Etappe B).
 */
export function agendaSignatureList(
  items: CtAgendaItem[],
): { id: number; sig: string; title: string }[] {
  return items.map((i) => ({ id: i.id, sig: agendaItemSignature(i), title: i.title }));
}

/** Längste aufsteigende Teilsequenz (Positionen). Die NICHT enthaltenen Punkte gelten als verschoben. */
function lisPositions(arr: number[]): Set<number> {
  const n = arr.length;
  const keep = new Set<number>();
  if (n === 0) return keep;
  const len = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);
  let best = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[j] < arr[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (len[i] > len[best]) best = i;
  }
  for (let i = best; i !== -1; i = prev[i]) keep.add(i);
  return keep;
}

/**
 * Vergleicht den zuletzt gesehenen Ablauf-Stand (`prev`) mit dem aktuellen (`current`) und liefert,
 * welche Punkte sich verändert haben (#161). Rein & testbar.
 * - `changedIds`: neu, inhaltlich geändert ODER verschoben (relative Reihenfolge über LIS).
 * - `removedIds`: im vorigen Stand vorhanden, jetzt weg (für die „auflösen"-Animation, Etappe B).
 * Ist `prev` leer (nie gesehen), gilt NICHTS als geändert (kein Fehlalarm bei Erstnutzung).
 */
export function diffAgendaItems(
  prev: { id: number; sig: string; title?: string }[],
  current: { id: number; sig: string }[],
): {
  changedIds: number[];
  /** Entfernte Punkte samt Titel und „stand hinter welchem noch vorhandenen Punkt" (afterId,
   *  null = ganz vorne) – der Client blendet sie dort kurz ein und lässt sie auflösen (Etappe B). */
  removed: { id: number; title: string; afterId: number | null }[];
} {
  if (prev.length === 0) return { changedIds: [], removed: [] };
  const prevById = new Map(prev.map((p, index) => [p.id, { sig: p.sig, index }]));
  const changed = new Set<number>();
  for (const it of current) {
    const p = prevById.get(it.id);
    if (!p || p.sig !== it.sig) changed.add(it.id); // neu oder inhaltlich geändert
  }
  // Verschoben: gemeinsame Punkte (unabhängig von Inhaltsänderung) auf Reihenfolge prüfen.
  const common = current.filter((it) => prevById.has(it.id));
  const keep = lisPositions(common.map((it) => prevById.get(it.id)!.index));
  common.forEach((it, k) => {
    if (!keep.has(k)) changed.add(it.id);
  });
  // Entfernt: im vorigen Stand, jetzt weg. Für die Position den letzten noch vorhandenen Vorgänger
  // im vorigen Stand suchen (afterId) – dort blendet der Client den „aufgelöst"-Platzhalter ein.
  const currentIds = new Set(current.map((it) => it.id));
  const removed: { id: number; title: string; afterId: number | null }[] = [];
  prev.forEach((p, i) => {
    if (currentIds.has(p.id)) return;
    let afterId: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (currentIds.has(prev[j].id)) {
        afterId = prev[j].id;
        break;
      }
    }
    removed.push({ id: p.id, title: p.title ?? 'Entfernter Punkt', afterId });
  });
  return { changedIds: [...changed], removed };
}

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
export function isHeaderType(type?: string): boolean {
  return !!type && /header|überschrift|heading|section/i.test(type);
}

/** Formatiert eine CT-Startzeit (ISO/UTC) als deutsche Ortszeit „HH:MM"; null bei fehlender/ungültiger Zeit. */
export function formatBerlinTime(iso?: string | null): string | null {
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
export function cleanServiceName(service?: string): string {
  return (service ?? '')
    .replace(/[[\]]/g, '')
    .replace(/\?+\s*$/, '')
    .trim();
}

/**
 * Zuständige als Einträge, ohne Duplikate: für besetzte Plätze der Personenname (open=false),
 * für offene Dienst-Plätze (z.B. „[Musik]") der Dienstname (open=true).
 *
 * Manuell als Freitext eingetragene Zuständige (nicht über einen Dienst zugewiesen) stehen in
 * ChurchTools nur im `text`-Feld, nicht in `persons[]` – die ergänzen wir zusätzlich. Dienst-Tokens
 * in eckigen Klammern (z.B. „[Moderation]") sind dort bereits über `persons[]` aufgelöst und werden
 * hier übersprungen.
 */
export function responsibleEntries(item: {
  responsible?: { text?: string; persons?: { service?: string; person?: { title?: string } }[] };
}): ResponsibleEntry[] {
  const entries: ResponsibleEntry[] = [];
  const seen = new Set<string>();
  const push = (label: string, open: boolean): void => {
    if (!label) return;
    const key = `${label}|${open}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ label, open });
  };
  for (const p of item.responsible?.persons ?? []) {
    const name = p.person?.title?.trim();
    push(name || cleanServiceName(p.service), !name);
  }
  for (const part of (item.responsible?.text ?? '').split(',')) {
    const label = part.trim();
    if (!label || label.includes('[')) continue; // Dienst-Tokens kommen über persons[]
    push(label, false);
  }
  return entries;
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
