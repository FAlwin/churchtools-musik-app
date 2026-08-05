/**
 * Teilen-Merker für Team-Notizen (PCO-Modell): Jedes Konto entscheidet selbst, ob seine
 * Anmerkungen für berechtigte Team-Mitglieder sichtbar sind. Eine kleine JSON-Datei auf dem
 * Volume (`sharing.json`): userId → { name, enabled }. Der Anzeigename wird beim Umschalten
 * mitgespeichert, damit die „Notizen von …"-Liste ohne ChurchTools-Abfragen auskommt.
 */
import path from 'node:path';
import { config } from '../config.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

interface Entry {
  name: string;
  enabled: boolean;
}
type Store = Record<string, Entry>;

function file(): string {
  return path.join(config.annotationsPath, 'sharing.json');
}

let cache: Store | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function read(): Promise<Store> {
  if (cache) return cache;
  // Nur „Datei gibt es noch nicht" ist leer; jeder andere Lesefehler wirft (#273) und lässt `cache`
  // unangetastet auf `null`. Hier besonders wichtig: Diese Datei gilt für ALLE Konten – ein
  // Zurückschreiben aus einem leeren Stand hätte die Teilen-Einstellungen der ganzen Gemeinde gelöscht.
  cache = (await readJsonStore<Store>(file(), 'Teilen-Einstellungen')) ?? {};
  return cache;
}

async function write(store: Store): Promise<void> {
  cache = store;
  const run = async (): Promise<void> => {
    await writeJsonStore(file(), JSON.stringify(store));
  };
  writeChain = writeChain.then(run, run);
  return writeChain.then(
    () => {},
    () => {},
  );
}

/** Teilen für ein Konto ein-/ausschalten (Name wird für die Anzeige mitgeführt). */
export async function setSharing(userId: number, name: string, enabled: boolean): Promise<void> {
  const store = await read();
  store[String(userId)] = { name, enabled };
  await write(store);
}

/** Teilt dieses Konto seine Anmerkungen? */
export async function isSharing(userId: number): Promise<boolean> {
  const store = await read();
  return store[String(userId)]?.enabled === true;
}

/** Alle Konten, die aktuell teilen (id + Anzeigename). */
export async function listSharers(): Promise<Array<{ id: number; name: string }>> {
  const store = await read();
  return Object.entries(store)
    .filter(([, e]) => e.enabled)
    .map(([id, e]) => ({ id: Number(id), name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Nur für Tests. */
export function __resetForTests(): void {
  cache = null;
  writeChain = Promise.resolve();
}
