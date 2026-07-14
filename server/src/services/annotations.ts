/**
 * Kontobezogene Speicherung der Anmerkungen (Striche + Textfelder + Zoom) je Lied-Version-Seite.
 * Ohne DB: eine JSON-Datei pro ChurchTools-Konto auf dem Volume (wie site.json), atomar geschrieben.
 * Schlüssel je Eintrag: `song<id>_v<versionKey>_<seite>`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';
// Anmerkungs-Typen kommen aus @shared/types – EINZIGE Quelle für Client + Server. Re-Export,
// damit Bestandsimporte aus diesem Modul weiter funktionieren.
import type { AnnotationText, PageAnnotation } from '@shared/types/index';

export type { AnnotationText, PageAnnotation };

type Store = Record<string, PageAnnotation>;

// ── Obergrenzen je Konto (#139) ───────────────────────────────────────────────────────────────
// Ohne Grenze könnte ein angemeldeter Nutzer beliebig viele/große Einträge anlegen und das Volume
// (und – über den Cache – den RAM) fluten. Beides ist großzügig über realem Bedarf (ein Nutzer
// annotiert praktisch ein paar hundert Seiten), deckelt aber den Missbrauch hart.
/** Höchstzahl Anmerkungs-Einträge (Lied-Version-Seiten) je Konto. */
export const MAX_ENTRIES_PER_ACCOUNT = 5000;
/** Höchstgröße der gesamten Konto-Datei in Bytes (serialisiert). */
export const MAX_BYTES_PER_ACCOUNT = 50 * 1024 * 1024; // 50 MB
/** Höchstzahl gleichzeitig im RAM gehaltener Konten (LRU); begrenzt den Cache-Speicher. */
const MAX_CACHED_ACCOUNTS = 300;

/** Rein & testbar: Liegt ein Konto-Store mit dieser Eintragszahl + Bytegröße im erlaubten Rahmen? */
export function withinAccountLimits(entryCount: number, totalBytes: number): boolean {
  return entryCount <= MAX_ENTRIES_PER_ACCOUNT && totalBytes <= MAX_BYTES_PER_ACCOUNT;
}

function fileFor(userId: number): string {
  return path.join(config.annotationsPath, `${userId}.json`);
}

const cache = new Map<number, Store>();
// Schreibzugriffe je Konto serialisieren (kein Clobbern bei parallelen Speicherungen).
const locks = new Map<number, Promise<unknown>>();

/**
 * Legt/aktualisiert einen Cache-Eintrag als jüngsten und wirft bei Überlauf den ältesten hinaus
 * (LRU, #139). Map bewahrt die Einfüge-Reihenfolge → der erste Schlüssel ist der älteste. Die
 * Datei bleibt die Wahrheit; ein evictetes Konto wird beim nächsten Zugriff neu von Disk gelesen.
 */
function cacheSet(userId: number, store: Store): void {
  cache.delete(userId); // ans Ende (= jüngster) verschieben
  cache.set(userId, store);
  if (cache.size > MAX_CACHED_ACCOUNTS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

async function read(userId: number): Promise<Store> {
  const cached = cache.get(userId);
  if (cached) {
    cacheSet(userId, cached); // als jüngst genutzt markieren (LRU)
    return cached;
  }
  try {
    const raw = await fs.readFile(fileFor(userId), 'utf-8');
    const data = JSON.parse(raw) as Store;
    cacheSet(userId, data);
    return data;
  } catch {
    const empty: Store = {};
    cacheSet(userId, empty);
    return empty;
  }
}

async function write(userId: number, store: Store, serialized?: string): Promise<void> {
  cacheSet(userId, store);
  await fs.mkdir(config.annotationsPath, { recursive: true });
  const file = fileFor(userId);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, serialized ?? JSON.stringify(store), 'utf-8');
  await fs.rename(tmp, file);
}

/** Führt `fn` aus, sodass Schreibzugriffe desselben Kontos nacheinander laufen. */
async function withLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    userId,
    run.catch(() => {}),
  );
  return run;
}

/** Ist ein Eintrag leer (kann verworfen werden)? */
function isEmpty(a: PageAnnotation): boolean {
  return !a.strokes && (!a.texts || a.texts.length === 0) && !a.zoom;
}

/** Alle Einträge eines Kontos zu den genannten Liedern (leere songIds = alle). */
export async function getAnnotations(userId: number, songIds: number[]): Promise<Store> {
  const store = await read(userId);
  if (songIds.length === 0) return store;
  const set = new Set(songIds);
  const out: Store = {};
  for (const [key, value] of Object.entries(store)) {
    const m = key.match(/^song(\d+)_/);
    if (m && set.has(Number(m[1]))) out[key] = value;
  }
  return out;
}

/** Aktualisiert einen Eintrag (Feld-Merge: nur übergebene Felder überschreiben). */
export async function putAnnotation(userId: number, key: string, partial: PageAnnotation): Promise<void> {
  await withLock(userId, async () => {
    const store = await read(userId);
    const cur = store[key] ?? {};
    const next: PageAnnotation = { ...cur };
    if ('strokes' in partial) next.strokes = partial.strokes ?? null;
    if ('texts' in partial) next.texts = partial.texts ?? [];
    if ('zoom' in partial) next.zoom = partial.zoom ?? null;
    // Leerer Eintrag → löschen (verkleinert immer, keine Grenzprüfung nötig).
    if (isEmpty(next)) {
      if (key in store) {
        delete store[key];
        await write(userId, store);
      }
      return;
    }
    // Konto-Obergrenze (#139) am fertigen Kandidaten prüfen. Das reine Löschen (isEmpty, oben) ist
    // davon ausgenommen → ein über die Grenze geratenes Konto lässt sich immer wieder freiräumen.
    // Die Grenzen liegen weit über realem Bedarf; im Alltag greift das nie. Serialisierung wird an
    // `write` weitergereicht, damit sie nicht doppelt anfällt.
    const candidate: Store = { ...store, [key]: next };
    const serialized = JSON.stringify(candidate);
    if (!withinAccountLimits(Object.keys(candidate).length, Buffer.byteLength(serialized))) {
      throw new HttpError(
        413,
        'Speicher-Obergrenze für Anmerkungen erreicht. Bitte nicht mehr benötigte Anmerkungen löschen.',
      );
    }
    store[key] = next;
    await write(userId, store, serialized);
  });
}

/** Löscht einen Eintrag. */
export async function deleteAnnotation(userId: number, key: string): Promise<void> {
  await withLock(userId, async () => {
    const store = await read(userId);
    if (store[key]) {
      delete store[key];
      await write(userId, store);
    }
  });
}
