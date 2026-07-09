/**
 * Kontobezogene Lied-/Versions-Einstellungen (Tonart, Kapo, Spalten, Schrift, Nur-Text,
 * Abschnitte, gewählte Version, Anzeige-Quelle). Ohne DB: eine JSON-Datei pro Konto auf dem
 * Volume (wie annotations). Gespeichert als einfache Schlüssel→Wert-Tabelle (localStorage-Keys).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

type Store = Record<string, string>;

// Erlaubte Einstellungs-Schlüssel (mit eingebetteter Lied-ID) – begrenzt, was synchronisiert wird.
export const SETTINGS_KEY_RE = /^worship_(?:key|capo|cols|fs|lyrics|secshift|ver|view)_\d+/;
/** Lied-ID aus einem Einstellungs-Schlüssel ziehen. */
function songIdOf(key: string): number | null {
  const m = key.match(/^worship_(?:key|capo|cols|fs|lyrics|secshift|ver|view)_(\d+)/);
  return m ? Number(m[1]) : null;
}

function fileFor(userId: number): string {
  return path.join(config.annotationsPath, `settings-${userId}.json`);
}

const cache = new Map<number, Store>();
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

async function withLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    userId,
    run.catch(() => {}),
  );
  return run;
}

/** Alle Einstellungen eines Kontos zu den genannten Liedern (leere songIds = alle). */
export async function getSettings(userId: number, songIds: number[]): Promise<Store> {
  const store = await read(userId);
  if (songIds.length === 0) return store;
  const set = new Set(songIds);
  const out: Store = {};
  for (const [key, value] of Object.entries(store)) {
    const id = songIdOf(key);
    if (id !== null && set.has(id)) out[key] = value;
  }
  return out;
}

/** Mehrere Einstellungen setzen/entfernen (null/"" entfernt). Nur erlaubte Schlüssel. */
export async function putSettings(userId: number, entries: Record<string, string | null>): Promise<void> {
  await withLock(userId, async () => {
    const store = await read(userId);
    for (const [key, value] of Object.entries(entries)) {
      if (!SETTINGS_KEY_RE.test(key)) continue;
      if (value === null || value === '') delete store[key];
      else store[key] = String(value).slice(0, 4000);
    }
    await write(userId, store);
  });
}
