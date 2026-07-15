/**
 * „Zuletzt gesehener Setlist-Stand" je Konto und Termin (#143).
 *
 * Der Server bildet für jede Setlist einen Fingerabdruck (Lieder + Reihenfolge + Tonart, siehe
 * `setlistBuilder.setlistFingerprint`). Öffnet ein Konto einen Termin, wird der aktuelle
 * Fingerabdruck hier gemerkt. Weicht er später ab, weiß die Terminliste: „hat sich seit deinem
 * letzten Reinschauen geändert" → Badge. Ist noch kein Stand gemerkt (nie geöffnet), gilt der
 * Termin NICHT als geändert (kein Fehlalarm bei Erstnutzung).
 *
 * Ohne DB: eine gemeinsame JSON-Datei auf dem Volume, atomar geschrieben (wie capabilities-cache).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

interface SeenEntry {
  /** Fingerabdruck der Setlist beim letzten Ansehen. */
  hash: string;
  /** Zeitpunkt des letzten Ansehens (ms) – für die Alters-Bereinigung. */
  seenAt: number;
  /** Signatur je Punkt beim letzten Ansehen (#161) – Basis für „was hat sich geändert". Optional
   *  (ältere Einträge haben es nicht → beim nächsten Ansehen ergänzt). */
  items?: { id: number; sig: string }[];
}
/** eventId → gesehener Stand. */
type EventMap = Record<string, SeenEntry>;
/** userId → EventMap. */
type Store = Record<string, EventMap>;

/** Einträge, die länger nicht mehr angesehen wurden, fliegen raus (Termine sind vergänglich). */
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 Tage

let store: Store | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
/** Nur EINMAL warnen, wenn Schreiben dauerhaft scheitert (z. B. Pfad nicht beschreibbar). */
let warnedWriteError = false;

async function load(): Promise<Store> {
  if (store) return store;
  try {
    store = JSON.parse(await fs.readFile(config.seenSetlistsPath, 'utf-8')) as Store;
  } catch {
    store = {};
  }
  return store;
}

/** Gesehene Stände eines Kontos (eventId → Eintrag). Leeres Objekt, wenn nichts gemerkt. */
export async function getSeenSetlists(userId: number): Promise<EventMap> {
  return (await load())[String(userId)] ?? {};
}

/**
 * Merkt den aktuellen Fingerabdruck als „gesehen" für Konto + Termin und räumt dabei zu alte
 * Einträge des Kontos aus. Best effort – Schreibfehler werden geschluckt (das Badge ist ein
 * Komfort-Hinweis, kein kritischer Zustand).
 */
export async function markSeenSetlist(
  userId: number,
  eventId: number,
  hash: string,
  items?: { id: number; sig: string }[],
  now: number = Date.now(),
): Promise<void> {
  const s = await load();
  const uid = String(userId);
  const events: EventMap = s[uid] ?? {};
  // Alters-Bereinigung, damit die Datei über Jahre nicht unbegrenzt wächst.
  for (const [id, entry] of Object.entries(events)) {
    if (now - entry.seenAt > MAX_AGE_MS) delete events[id];
  }
  events[String(eventId)] = { hash, seenAt: now, items };
  s[uid] = events;
  const write = async (): Promise<void> => {
    await fs.mkdir(path.dirname(config.seenSetlistsPath), { recursive: true });
    const tmp = `${config.seenSetlistsPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(s), 'utf-8');
    await fs.rename(tmp, config.seenSetlistsPath);
  };
  writeChain = writeChain.then(write, write);
  return writeChain.then(
    () => {},
    (e: unknown) => {
      // Best effort bleibt: Fehler bricht nichts ab. Aber ein dauerhaft scheiterndes Schreiben
      // (fehlendes/unbeschreibbares Volume) soll sichtbar sein – sonst leben die Stände nur im
      // RAM und sind nach jedem Neustart weg.
      if (!warnedWriteError) {
        warnedWriteError = true;
        console.warn(
          `Seen-Setlists: Schreiben nach ${config.seenSetlistsPath} fehlgeschlagen – Stände gehen bei Neustart verloren:`,
          e instanceof Error ? e.message : e,
        );
      }
    },
  );
}

/** Nur für Tests: In-Memory-Zustand zurücksetzen, damit die Datei erneut gelesen wird. */
export function __resetForTests(): void {
  store = null;
  writeChain = Promise.resolve();
  warnedWriteError = false;
}
