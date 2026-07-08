/**
 * Rechte-Cache: merkt sich pro ChurchTools-Konto die zuletzt gültigen (Zugriffs-)Rechte.
 *
 * Hintergrund: ChurchTools liefert `/api/permissions/global` sporadisch mit leeren Rechte-Arrays
 * zurück, obwohl der Nutzer Zugriff hat (das passiert beim Neuberechnen der Session-Rechte und kann
 * mehrere Sekunden dauern – länger als das Wiederhol-Fenster im Client). Ohne Cache sieht der Nutzer
 * dann fälschlich „keine Berechtigung". Mit Cache liefert der Server in diesem Moment die zuletzt
 * gültigen Rechte aus → der Aussetzer bleibt unsichtbar.
 *
 * Ohne DB: eine einzelne JSON-Datei auf dem Volume (wie site.json), atomar geschrieben. Gecacht wird
 * bewusst NUR, wenn der Nutzer echten Zugriff hatte (siehe `getCapabilities`) – ein „darf nichts"
 * landet nie im Cache, damit echte Nicht-Berechtigte nie fälschlich Zugriff aus dem Cache bekommen.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { UserCapabilities } from './churchtools.js';

/**
 * Wie lange ein gemerkter Rechtestand als vertrauenswürdig gilt. Danach wird er nicht mehr zum
 * Überbrücken herangezogen (begrenzt das Zeitfenster, in dem zwischenzeitlich in ChurchTools
 * entzogene Rechte noch aus dem Cache „nachwirken" könnten). Großzügig, aber nicht endlos.
 */
export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

interface Entry {
  caps: UserCapabilities;
  savedAt: number;
}
type Store = Record<string, Entry>;

/** Ist ein zum Zeitpunkt `savedAt` gemerkter Stand jetzt (`now`) noch frisch genug? (rein, testbar) */
export function isCacheFresh(savedAt: number, now = Date.now()): boolean {
  return now - savedAt <= CACHE_MAX_AGE_MS;
}

let store: Store | null = null;
// Schreibzugriffe serialisieren (eine gemeinsame Datei) – kein Clobbern bei parallelen Anmeldungen.
let writeChain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Store> {
  if (store) return store;
  try {
    store = JSON.parse(await fs.readFile(config.capabilitiesCachePath, 'utf-8')) as Store;
  } catch {
    store = {};
  }
  return store;
}

/** Zuletzt gültige Rechte des Kontos – nur, wenn vorhanden UND nicht zu alt. Sonst `null`. */
export async function getCachedCapabilities(
  userId: number,
  now = Date.now(),
): Promise<UserCapabilities | null> {
  const entry = (await load())[String(userId)];
  if (!entry || !isCacheFresh(entry.savedAt, now)) return null;
  return entry.caps;
}

/** Merkt sich die (gültigen) Rechte des Kontos. Best effort – Schreibfehler werden geschluckt. */
export async function rememberCapabilities(
  userId: number,
  caps: UserCapabilities,
  now = Date.now(),
): Promise<void> {
  const s = await load();
  s[String(userId)] = { caps, savedAt: now };
  const write = async (): Promise<void> => {
    await fs.mkdir(path.dirname(config.capabilitiesCachePath), { recursive: true });
    const tmp = `${config.capabilitiesCachePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(s), 'utf-8');
    await fs.rename(tmp, config.capabilitiesCachePath);
  };
  writeChain = writeChain.then(write, write);
  return writeChain.then(
    () => {},
    () => {},
  );
}

/** Nur für Tests: den In-Memory-Zustand zurücksetzen, damit die Datei erneut gelesen wird. */
export function __resetForTests(): void {
  store = null;
  writeChain = Promise.resolve();
}
