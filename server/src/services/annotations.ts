/**
 * Kontobezogene Speicherung der Anmerkungen (Striche + Textfelder + Zoom) je Lied-Version-Seite.
 * Ohne DB: eine JSON-Datei pro ChurchTools-Konto auf dem Volume (wie site.json), atomar geschrieben.
 * Schlüssel je Eintrag: `song<id>_v<versionKey>_<seite>`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
// Anmerkungs-Typen kommen aus @shared/types – EINZIGE Quelle für Client + Server. Re-Export,
// damit Bestandsimporte aus diesem Modul weiter funktionieren.
import type { AnnotationText, PageAnnotation } from '@shared/types/index';

export type { AnnotationText, PageAnnotation };

type Store = Record<string, PageAnnotation>;

function fileFor(userId: number): string {
  return path.join(config.annotationsPath, `${userId}.json`);
}

const cache = new Map<number, Store>();
// Schreibzugriffe je Konto serialisieren (kein Clobbern bei parallelen Speicherungen).
const locks = new Map<number, Promise<unknown>>();

async function read(userId: number): Promise<Store> {
  const cached = cache.get(userId);
  if (cached) return cached;
  try {
    const raw = await fs.readFile(fileFor(userId), 'utf-8');
    const data = JSON.parse(raw) as Store;
    cache.set(userId, data);
    return data;
  } catch {
    const empty: Store = {};
    cache.set(userId, empty);
    return empty;
  }
}

async function write(userId: number, store: Store): Promise<void> {
  cache.set(userId, store);
  await fs.mkdir(config.annotationsPath, { recursive: true });
  const file = fileFor(userId);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store), 'utf-8');
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
    if (isEmpty(next)) delete store[key];
    else store[key] = next;
    await write(userId, store);
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
