/**
 * Gemeinsame („globale") Anmerkungen fürs Team – EINE Datei `_shared.json` auf dem Volume
 * (neben den kontobezogenen `<userId>.json`). Kollaborativ: jeder Verwaltungsberechtigte darf jede
 * globale Anmerkung bearbeiten/löschen. Schlüssel wie privat: `song<id>_v<versionKey>_<seite>`.
 *
 * Struktur je Seite: EINE gemeinsame Striche-PNG (gemeinsames Whiteboard) + Liste globaler Texte.
 * Jeder Text trägt seinen `author` (wer ihn angelegt hat) – nur zur Anzeige; beim Speichern bleibt
 * ein vorhandener Autor erhalten, neue Texte bekommen den aktuellen Nutzer. Kein Zoom (immer privat).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { AnnotationText } from './annotations.js';

export interface NoteAuthor {
  id: number;
  name: string;
}

export interface SharedText extends AnnotationText {
  author?: NoteAuthor;
}

export interface SharedPageAnnotation {
  /** Gemeinsame Striche als PNG-DataURL (oder null = keine). */
  strokes?: string | null;
  /** Globale Textfelder der Seite (je mit Autor). */
  texts?: SharedText[];
}

type Store = Record<string, SharedPageAnnotation>;

function file(): string {
  return path.join(config.annotationsPath, '_shared.json');
}

let cache: Store | null = null;
// Schreibzugriffe serialisieren (eine gemeinsame Datei) – kein Clobbern bei parallelen Speicherungen.
let writeChain: Promise<unknown> = Promise.resolve();

async function read(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(file(), 'utf-8')) as Store;
  } catch {
    cache = {};
  }
  return cache;
}

async function write(store: Store): Promise<void> {
  cache = store;
  const run = async (): Promise<void> => {
    await fs.mkdir(config.annotationsPath, { recursive: true });
    const tmp = `${file()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store), 'utf-8');
    await fs.rename(tmp, file());
  };
  writeChain = writeChain.then(run, run);
  return writeChain.then(
    () => {},
    () => {},
  );
}

/** Ist ein Eintrag leer (kann verworfen werden)? */
function isEmpty(a: SharedPageAnnotation): boolean {
  return !a.strokes && (!a.texts || a.texts.length === 0);
}

/** Alle globalen Einträge zu den genannten Liedern (leere songIds = alle). */
export async function getSharedAnnotations(songIds: number[]): Promise<Store> {
  const store = await read();
  if (songIds.length === 0) return store;
  const set = new Set(songIds);
  const out: Store = {};
  for (const [key, value] of Object.entries(store)) {
    const m = key.match(/^song(\d+)_/);
    if (m && set.has(Number(m[1]))) out[key] = value;
  }
  return out;
}

/**
 * Aktualisiert einen globalen Eintrag (Feld-Merge). `strokes` ersetzt die gemeinsame Striche-Ebene;
 * `texts` ersetzt die Textliste. Texte ohne (gültigen) Autor bekommen den aktuellen Nutzer gestempelt;
 * vorhandene Autoren bleiben erhalten (kollaboratives Bearbeiten fremder Texte relabelt sie nicht).
 */
export async function putSharedAnnotation(
  key: string,
  partial: SharedPageAnnotation,
  author: NoteAuthor,
): Promise<void> {
  const store = await read();
  const cur = store[key] ?? {};
  const next: SharedPageAnnotation = { ...cur };
  if ('strokes' in partial) next.strokes = partial.strokes ?? null;
  if ('texts' in partial) {
    next.texts = (partial.texts ?? []).map((t) => ({
      ...t,
      author: t.author && Number.isInteger(t.author.id) ? t.author : author,
    }));
  }
  if (isEmpty(next)) delete store[key];
  else store[key] = next;
  await write(store);
}

/** Löscht einen globalen Eintrag komplett. */
export async function deleteSharedAnnotation(key: string): Promise<void> {
  const store = await read();
  if (store[key]) {
    delete store[key];
    await write(store);
  }
}

/** Nur für Tests: In-Memory-Zustand zurücksetzen. */
export function __resetForTests(): void {
  cache = null;
  writeChain = Promise.resolve();
}
