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
 * entzogene Rechte noch aus dem Cache „nachwirken" könnten).
 *
 * **12 Stunden statt der früheren 30 Tage (#249).** Zu überbrücken sind Aussetzer von Sekunden – ein
 * Monat war dafür um Größenordnungen zu großzügig. 12 Stunden decken den eigentlichen Zweck
 * vollständig und halten zusätzlich den Fall ab, dass jemand am Samstagabend vorbereitet und am
 * Sonntagmorgen wieder öffnet, während ChurchTools gerade schwächelt.
 */
export const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 Stunden

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

/**
 * Zuletzt gültige Rechte des Kontos – nur, wenn vorhanden UND nicht zu alt. Sonst `null`.
 *
 * **`isAdmin` wird NIE überbrückt (#249).** Am Admin-Recht hängen schreibende Verwaltungs-Endpunkte
 * (`PUT /api/site-config`, Gruppen-/Rollen-Zuweisung). Ein Konto, dem in ChurchTools gerade das Recht
 * entzogen wurde, dessen Sitzung aber noch lebt, dürfte sonst bis zum Ablauf des Fensters weiter
 * schreiben. Die Lese-Rechte zu überbrücken ist der Zweck des Caches – ein Verwaltungsrecht nicht.
 * Der echte Admin sieht die Verwaltung während eines ChurchTools-Aussetzers kurz nicht; das ist der
 * bewusst konservative Preis.
 *
 * Die Regel sitzt hier und nicht beim Aufrufer, damit sie auch für einen künftigen zweiten Aufrufer
 * gilt.
 */
export async function getCachedCapabilities(
  userId: number,
  now = Date.now(),
): Promise<UserCapabilities | null> {
  const entry = (await load())[String(userId)];
  if (!entry || !isCacheFresh(entry.savedAt, now)) return null;
  return { ...entry.caps, isAdmin: false };
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
