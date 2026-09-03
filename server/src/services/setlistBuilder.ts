/**
 * Baut aus den ChurchTools-Rohdaten unsere App-Strukturen:
 *  - Liste der Gottesdienste, die tatsächlich eine Setlist (Agenda mit Songs) haben
 *  - die Songs einer Setlist inkl. heruntergeladenem ChordPro-Inhalt
 */
import type {
  AgendaItem,
  ArrangementFileEntry,
  Service,
  SetlistSong,
  SongLibraryEntry,
  SongVersion,
} from '@shared/types/index';
import { downloadFileText, fileIdFromUrl } from './ctFiles.js';
import { CtOverloadedError, isCtOverloaded } from './ctHttp.js';
import { createGebuendelterLauf } from './gebuendelterLauf.js';
import { mapLimit } from './mapLimit.js';
import {
  getAgenda,
  getAllSongs,
  getAppointmentSubtitle,
  getArrangement,
  getEvents,
  getSong,
} from './ctRead.js';
import type { CtAgendaSong } from './ctTypes.js';
import { deleteFile, uploadChordpro, uploadFile } from './ctWrite.js';
import { fetchChordProText, getSongSelectSong } from './ctSongSelect.js';
import type { CtArrangementFile, CtSong } from './ctTypes.js';
import {
  versionSlug,
  versionNameOf,
  versionFileName,
  isVersionFile,
  isOriginalChordpro,
  documentsOf,
  arrangementFileEntries,
  safeFileName,
} from './arrangementFiles.js';
import { metaValue } from './chordproMeta.js';
import { setlistFingerprint, agendaSignatureList, diffAgendaItems } from './agendaDiff.js';
import { isHeaderType, formatBerlinTime, responsibleEntries } from './agendaFormat.js';
import { HttpError } from '../middleware/errorHandler.js';
import { mapEventToService } from '../utils/mapEvent.js';

/**
 * Tempo aus ChurchTools in eine Zahl bringen – oder `null`.
 *
 * ChurchTools liefert `bpm` je nach Endpunkt als Zahl ODER als Zeichenkette (`"120"`); der Typ
 * behauptete bisher `number`. Ohne Umrechnung stünde in `SetlistSong.bpm` zur Laufzeit ein Text,
 * obwohl dort `number` steht – und alles, was mit `typeof === 'number'` prüft, hielte das Lied
 * für tempolos. Genau das trifft den Tempo-Puls (#145): Der Knopf wäre schlicht nicht erschienen.
 *
 * Aufgefallen, weil der Typ beim Erweitern von `CtArrangement` ehrlich gemacht wurde und der
 * Compiler daraufhin ZWEI Stellen zeigte. Die Umrechnung steht deshalb einmal hier, nicht zweimal
 * daneben.
 */
function alsTempoZahl(wert: number | string | null | undefined): number | null {
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;
  if (typeof wert === 'string') {
    const n = Number(wert.trim());
    return wert.trim() !== '' && Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Beim Sammeln über viele Termine ist ein fehlender Ablaufplan (404) normal und wird still
 * übersprungen. Ein anderer Fehler (CT-500, Netz-Aussetzer) darf NICHT unbemerkt Termine aus der
 * Liste/Statistik fallen lassen – daher einmal pro Vorkommen warnen.
 */
function skipMissingAgenda(context: string, e: unknown): void {
  if (e instanceof HttpError && e.status === 404) return; // kein Ablaufplan – erwartet
  console.warn(`${context}: Ablauf-Abruf fehlgeschlagen (Termin übersprungen):`, e);
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
  /** Konto-Kennung (`accountKey`) – nur für das Untertitel-Memo, das je Konto trennt (#199/#306). */
  account: string,
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
          ? getAppointmentSubtitle(cookie, calId, ev.appointmentId, account)
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
    /**
     * Die ID des WIRKLICH benutzten Arrangements, nicht die aus dem Ablaufpunkt.
     *
     * Beides fällt normalerweise zusammen. Zeigt der Ablaufpunkt aber auf ein Arrangement, das es in
     * ChurchTools nicht mehr gibt, fällt `arr` oben auf das erste zurück – der Inhalt käme dann von
     * einem anderen Arrangement, als die ID behauptet. Bis #320 war das kosmetisch; seit die
     * Anmerkungs-Schlüssel die ID tragen, lägen die Notizen unter einer Nummer, die zum gezeigten
     * Blatt nicht passt.
     */
    arrangementId: arr?.id ?? agendaSong.arrangementId,
    arrangementName: arr?.name ?? agendaSong.arrangement ?? '',
    arrangementCount: song.arrangements.length,
    // `{title}`/`{artist}` aus der Datei gehen vor – genau wie Tonart und Taktart darüber (#236).
    // Wirkt damit in Kopfzeile, Ablaufplan, Blatt und PDF. Die Bibliothek „Alle Lieder" bleibt
    // beim ChurchTools-Namen: `getSongLibrary` hat keinen ChordPro-Text (siehe Kommentar dort).
    title: metaValue(source, 'title') ?? (agendaSong.title || song.name),
    author: metaValue(source, 'artist') ?? song.author ?? '',
    originalKey,
    targetKey,
    bpm: alsTempoZahl(agendaSong.bpm ?? arr?.bpm),
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
  const { song, arrangement: arr } = await getArrangement(cookie, songId, arrangementId);
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
//
// `eventIds` = die Termine, aus denen dieser Stand gebaut wurde (#300). Damit kann das Invalidieren
// präzise werden, statt bei jeder Ablauf-Änderung alles wegzuwerfen (siehe `invalidateSongUsageCache`).
//
// Bewusst KEIN `complete`-Feld: Ein Lauf, bei dem einzelne Termine mit 403/500 ausfielen, wird ganz
// normal gecacht und ausgeliefert – wie vor #300. Ein Feld zu führen, das nirgends gelesen wird, wäre
// toter Code, der eine Regel behauptet, die es nicht gibt. Das Sichtbarmachen einer unvollständigen
// Statistik in der Oberfläche ist ein eigener Schritt (am Issue vermerkt).
let usageCache: {
  at: number;
  data: Record<number, SongUsage>;
  eventIds: Set<number>;
} | null = null;

/** Sperrfrist nach einer Drosselung – lang genug, dass sich das CT-Limit erholt. */
const USAGE_COOLDOWN_MS = 120_000;
/**
 * Bündelung und Sperrfrist des Statistik-Laufs (#300) – **im Baustein, nicht mehr handgeschrieben.**
 *
 * Vorher standen `usageInflight` und `usageRetryAfter` hier als eigene Variablen. Mit dem Suchindex
 * über die Liedtexte kam ein zweiter Lauf derselben Art dazu; eine Kopie der Mechanik wäre genau die
 * Fehlerklasse, die dieses Projekt am häufigsten getroffen hat. Der Zwischenspeicher selbst bleibt
 * hier – was gecacht wird und wann es verfällt, ist bei beiden verschieden.
 */
const usageLauf = createGebuendelterLauf<Record<number, SongUsage>>(USAGE_COOLDOWN_MS);

/**
 * Leert den Statistik-Cache – **nur wenn dieser Termin überhaupt mitgezählt wurde** (#300).
 *
 * Vorher warf jede Ablauf-Änderung den ganzen Stand weg. Folge: Wer den nächsten Sonntag vorbereitet
 * (Lied hinzufügen, Titel ändern), entwertete die Statistik – und der nächste Blick in „Alle Lieder"
 * oder „Lied hinzufügen" löste einen **kalten Lauf mit ~250 ChurchTools-Anfragen** aus. Genau diese
 * Schleife hat das CT-Limit gerissen und danach Anmeldung, Rechte und Speichern mit lahmgelegt.
 *
 * Die Prüfung ist beweisbar richtig: Hat ein Termin nichts zum Stand beigetragen, kann sein Ändern
 * keine Zahl verändern. **Zukunftstermine sind nie im Set** (`date > to` unten filtert sie), das
 * Vorbereiten des nächsten Gottesdienstes invalidiert also nie mehr.
 */
export function invalidateSongUsageCache(eventId?: number): void {
  if (!usageCache) return;
  if (eventId === undefined || usageCache.eventIds.has(eventId)) {
    // Bewusst NICHT wegwerfen, sondern nur als „muss neu gebaut werden" markieren (`at = 0`):
    // Der Stand ist danach nur leicht veraltet, aber im Wesentlichen richtig. Scheitert der neue Lauf
    // an einer Drosselung, ist er die deutlich bessere Antwort als „keine Statistik" – ohne Zahlen
    // zeigt die Liederliste sonst „–" und die Sortierung nach Häufigkeit wird unbrauchbar.
    // `at = 0` heißt: TTL ist sicher abgelaufen → der nächste Aufruf baut neu.
    usageCache = { ...usageCache, at: 0 };
  }
}

/** Nur für Tests: Cache, laufender Abruf und Sperrfrist zurücksetzen. */
export function __resetSongUsageForTests(): void {
  usageCache = null;
  usageLauf.reset();
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
  // Nach einer Drosselung eine Weile gar nicht erst versuchen – sonst rennt jeder Aufruf erneut in
  // die Wand und verlängert die Drosselung, die er gerade abwarten sollte.
  if (usageLauf.istGesperrt()) {
    if (usageCache) return usageCache.data; // letzter bekannter Stand ist besser als nichts
    throw new CtOverloadedError(usageLauf.restMs());
  }
  // Läuft schon einer? `fuehreAus` hängt sich an (#300). Ohne das starten fünf iPads, die gleichzeitig
  // „Alle Lieder" öffnen, FÜNF volle Läufe – rund 1.235 ChurchTools-Anfragen statt 250.
  return usageLauf.fuehreAus(() => runSongUsage(cookie));
}

/** Der eigentliche Lauf – getrennt, damit `getSongUsageMap` nur noch Cache/Bündelung/Sperrfrist regelt. */
async function runSongUsage(cookie: string): Promise<Record<number, SongUsage>> {
  const started = Date.now();
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromD = new Date(today);
  fromD.setFullYear(fromD.getFullYear() - USAGE_LOOKBACK_YEARS);
  const from = fromD.toISOString().slice(0, 10);

  /** Bei Drosselung/Zeitüberschreitung sofort aufhören (#300) – siehe `bailOut` unten. */
  let overloaded = false;
  let events;
  try {
    events = await getEvents(cookie, from, to);
  } catch (e) {
    // Auch der EINE Termin-Abruf am Anfang kann gedrosselt werden – dann ist der Lauf hier zu Ende
    // und die Sperrfrist muss genauso greifen wie unten.
    if (isCtOverloaded(e)) return bailOut(e, 0, started);
    throw e;
  }

  const usage: Record<number, SongUsage> = {};
  const eventIds = new Set<number>();
  /** Termine mit einem echten Fehler (403/500) – die machen die Statistik unvollständig. */
  let skipped = 0;
  /** Termine ganz ohne Ablaufplan (404) – normal, kein Mangel. Nur zur Einordnung im Log. */
  let ohneAblauf = 0;
  await mapLimit(events, 8, async (ev) => {
    // Notbremse: Sobald ChurchTools gebremst hat, keine weiteren Anfragen mehr starten. Es laufen
    // höchstens noch die 8 begonnenen aus – statt weiterer ~240 in ein erschöpftes Limit.
    if (overloaded) return;
    try {
      const date = ev.startDate.slice(0, 10);
      if (date > to) return; // Sicherheitsnetz: keine Zukunftstermine mitzählen
      const agenda = await getAgenda(cookie, ev.id);
      eventIds.add(ev.id); // hat beigetragen → nur DIESE Termine dürfen den Stand invalidieren
      for (const it of agenda.items ?? []) {
        const id = it.song?.songId;
        if (!id) continue;
        (usage[id] ??= { dates: [] }).dates.push(date);
      }
    } catch (e) {
      if (isCtOverloaded(e)) {
        overloaded = true;
        return;
      }
      // Ein 404 heißt „dieser Termin hat gar keinen Ablaufplan" und ist der NORMALFALL: Im
      // 4-Jahres-Fenster liegen Gebetstreffen, Sitzungen und alles andere ohne Lieder. Er darf die
      // Statistik NICHT als unvollständig ausweisen (#300). Der erste Betriebslauf zeigte 175 von 223
      // Terminen ohne Ablauf – als „übersprungen" gezählt stand dauerhaft `vollständig=false` da, und
      // eine Warnung, die immer leuchtet, wird ignoriert.
      if (e instanceof HttpError && e.status === 404) ohneAblauf++;
      // Andere Fehler (403/500) überspringen nur diesen Termin und brechen den Lauf NICHT ab – sonst
      // würde ein dauerhaft unlesbarer Termin die Statistik für immer blockieren.
      else skipped++;
      skipMissingAgenda('getSongUsageMap', e);
    }
  });

  if (overloaded) return bailOut(null, events.length, started);

  // Termine je Lied absteigend sortieren (neuester zuerst) → Client nimmt [0] als „zuletzt".
  for (const u of Object.values(usage)) u.dates.sort((a, b) => b.localeCompare(a));
  usageCache = { at: Date.now(), data: usage, eventIds };
  usageLauf.entsperren();
  console.warn(
    `[songUsage] Lauf beendet: ${eventIds.size} mit Ablauf, ${ohneAblauf} ohne (normal), ` +
      `${skipped} fehlerhaft, vollständig=${skipped === 0}, ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  return usage;
}

/**
 * Abbruch wegen Drosselung (#300): Das Teilergebnis wird **verworfen**, nicht gecacht.
 *
 * Sonst würde eine im Sturm entstandene, viel zu kleine Statistik eine volle Stunde als Wahrheit
 * ausgeliefert – und über die Client-Persistenz sogar sieben Tage lang. Liegt noch ein **früherer**
 * Stand im Speicher, wird der weiter ausgeliefert (sein Alter bleibt unverändert, der Cache verlängert
 * sich also nicht selbst). Liegt keiner, ist ein ehrlicher Fehler besser als falsche Zahlen.
 *
 * Genau formuliert: der letzte BEKANNTE Stand, nicht zwingend ein vollständiger. Fielen darin einzelne
 * Termine mit 403/500 aus, ist er leicht zu niedrig – so wie er auch im Normalbetrieb ausgeliefert
 * würde. Diese Ehrlichkeit ist wichtig, weil eine frühere Fassung dieses Kommentars „vollständiger
 * Stand" behauptete, was der Code nie geprüft hat.
 */
function bailOut(e: unknown, geplant: number, started: number): Record<number, SongUsage> {
  const retryAfterMs = (e instanceof HttpError ? e.retryAfterMs : undefined) ?? USAGE_COOLDOWN_MS;
  usageLauf.sperren(retryAfterMs);
  console.warn(
    `[songUsage] Lauf ABGEBROCHEN (ChurchTools drosselt) nach ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s von ${geplant} Terminen; ` +
      `Sperrfrist ${Math.round(retryAfterMs / 1000)} s`,
  );
  if (usageCache) return usageCache.data;
  throw new CtOverloadedError(retryAfterMs);
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
        // Leer in ChurchTools kommt als `null` oder `""` – beides heißt „keine Nummer" (#378).
        ccli: s.ccli ? String(s.ccli) : null,
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
      bpm: alsTempoZahl(arr.bpm),
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

/**
 * Alle Dateien eines Arrangements auflisten (#321).
 *
 * Flach und ungefiltert – anders als `documents`, das nur die anzeigbaren Dokumente meint. Damit
 * werden auch Dateien sichtbar, die die App bisher nirgends zeigte (`.docx`, `.mp3`).
 */
export async function listArrangementFiles(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  const { arrangement } = await getArrangement(cookie, songId, arrangementId);
  return arrangementFileEntries(arrangement.files);
}

/**
 * Eine beliebige Datei an ein Arrangement hängen (#321).
 *
 * **Der Dateiname wird gereinigt, nicht geglaubt.** Er kommt aus dem Browser des Nutzers; ohne
 * `safeFileName` könnte ein Pfadtrenner darin stehen.
 *
 * **Das Arrangement wird zuerst geprüft.** `getArrangement` wirft 404, wenn es nicht zu diesem Lied
 * gehört – sonst wäre dieser Endpunkt ein Weg, Dateien an ein beliebiges fremdes Arrangement zu
 * hängen, nur weil man dessen Nummer kennt.
 *
 * **Ein vorhandener gleicher Name wird NICHT ersetzt** (ChurchTools tut das nicht, und wir tun es
 * auch nicht von uns aus): Die Datei läge danach zweimal da. Die Oberfläche warnt vorher, weil sie
 * die Liste kennt – ein ungefragtes Löschen fremder Dateien wäre der schlimmere Fehler.
 */
export async function addArrangementFile(
  cookie: string,
  songId: number,
  arrangementId: number,
  datei: { filename: string; mime: string; inhalt: Uint8Array },
): Promise<ArrangementFileEntry[]> {
  const filename = safeFileName(datei.filename);
  if (!filename) throw new HttpError(400, 'Bitte einen Dateinamen angeben.');
  await getArrangement(cookie, songId, arrangementId);
  await uploadFile(cookie, arrangementId, { ...datei, filename });
  // Die frische Liste zurückgeben: Der Aufrufer braucht die neue Datei-ID, und ein zweiter Abruf
  // durch den Client wäre eine Anfrage mehr gegen ChurchTools (#300).
  return listArrangementFiles(cookie, songId, arrangementId);
}

/**
 * Eine Datei des Lieds löschen (#321).
 *
 * **`resolveFileUrl` ist hier die Sicherung, nicht Beiwerk:** Es wirft 404, wenn die Datei nicht zu
 * diesem Lied gehört. Ohne diese Prüfung wäre der Endpunkt ein „lösche beliebige Datei in
 * ChurchTools" – die Nummer allein würde reichen, und ChurchTools prüft nur, ob man Lieder bearbeiten
 * darf, nicht WELCHE Datei gemeint war. Dieselbe Sorge wie bei `assertCtFileUrl` (#199).
 */
export async function removeArrangementFile(
  cookie: string,
  songId: number,
  fileId: number,
): Promise<void> {
  await resolveFileUrl(cookie, songId, fileId);
  await deleteFile(cookie, fileId);
}

/**
 * Das Notenblatt eines Liedes aus CCLI SongSelect ins Arrangement holen (#322, Schritt 9).
 *
 * **Pro Arrangement genau EIN Original-ChordPro.** Aus der Messung vom 11.08.2026: Die Datei bringt
 * ihre Tonart selbst mit (`{key: …}`), und `buildSong` sucht das Notenblatt mit
 * `files.find(isOriginalChordpro)` – die **erste** gewinnt. Lägen zwei da, entschiede die Reihenfolge
 * von ChurchTools, welche Fassung (und welche Tonart!) angezeigt wird. Nichts kracht, es ist nur
 * plötzlich anders. Deshalb wird ersetzt, nicht danebengelegt.
 *
 * **ERST holen, DANN das alte löschen** – und diese Reihenfolge ist der Kern dieser Funktion.
 * Andersherum stünde das Lied ohne Notenblatt da, sobald der Abruf bei CCLI scheitert (Netz, Lizenz,
 * Zeitüberschreitung). Im schlimmsten Fall bleibt so ein Doppel liegen; das ist ärgerlich, aber
 * behebbar – ein Lied ohne Blatt im Gottesdienst ist es nicht.
 *
 * **Die verwalteten Versionen bleiben unangetastet.** Sie gehören der App und dem Nutzer, nicht
 * CCLI; ersetzt wird nur das Original.
 */
export async function holeChordProAusSongSelect(
  cookie: string,
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  const { song, arrangement } = await getArrangement(cookie, songId, arrangementId);

  /**
   * Die Tonart des ARRANGEMENTS, sonst die von CCLI vorgeschlagene.
   *
   * Ohne beides wird abgebrochen, statt eine zu raten: Ein Notenblatt in einer zufälligen Tonart
   * ist schlimmer als keines – man merkt es erst beim Spielen.
   */
  const tonart = arrangement.keyOfArrangement ?? arrangement.key ?? null;
  const ausCcli = tonart ? null : await getSongSelectSong(cookie, songNumber);
  const tonality = tonart ?? ausCcli?.defaultKey ?? null;
  if (!tonality) {
    throw new HttpError(
      400,
      'Für dieses Arrangement ist keine Tonart hinterlegt, und CCLI schlägt keine vor. Bitte zuerst eine Tonart setzen.',
    );
  }

  // Vor dem Holen merken, was ersetzt werden soll – danach ist die neue Datei nicht mehr von der
  // alten zu unterscheiden (beide heißen `<Titel>.chordpro`).
  const vorher = arrangement.files.filter(isOriginalChordpro).map((f) => fileIdFromUrl(f.fileUrl));

  /**
   * **Erst den Text holen, dann selbst hochladen, dann aufräumen.**
   *
   * Der Aufruf bei CCLI liefert nur den Text – er legt nichts an (gemessen). Hochgeladen wird über
   * `uploadFile`, unsere eigene geprüfte Stelle: Sie wirft bei einem Fehlschlag, und erst danach
   * wird gelöscht. Damit ist die Reihenfolge eine echte Zusage und nicht mehr die Hoffnung, dass ein
   * `status: success` auch bedeutet, dass etwas entstanden ist.
   */
  const text = await fetchChordProText(cookie, {
    arrangementId,
    songNumber,
    title: song.name,
    tonality,
  });
  await uploadFile(cookie, arrangementId, {
    filename: `${safeFileName(song.name)}.chordpro`,
    mime: 'text/plain',
    inhalt: text,
  });

  for (const id of vorher) {
    // Ein Fehlschlag beim Aufräumen darf den Erfolg nicht umwerfen: Das neue Blatt liegt schon da.
    if (id !== null) await deleteFile(cookie, id).catch(() => undefined);
  }

  return listArrangementFiles(cookie, songId, arrangementId);
}
