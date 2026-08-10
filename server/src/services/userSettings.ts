/**
 * Kontobezogene Lied-/Versions-Einstellungen (Tonart, Kapo, Spalten, Schrift, Nur-Text,
 * Abschnitte, gewählte Version, Anzeige-Quelle). Ohne DB: eine JSON-Datei pro Konto auf dem
 * Volume (wie annotations). Gespeichert als einfache Schlüssel→Wert-Tabelle (localStorage-Keys).
 */
import path from 'node:path';
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

type Store = Record<string, string>;

// ── Obergrenzen je Konto (#195) ────────────────────────────────────────────────────────────────
// Die Anmerkungen haben solche Grenzen seit #139, die Einstellungen hatten keine: Schlüssel wurden
// nur per Regex geprüft, die ANZAHL war unbegrenzt → ein angemeldetes Gemeindeglied konnte per
// `PUT /api/settings` beliebig viele Schlüssel schreiben und damit das Volume (NAS) fluten.
// Die Werte liegen weit über realem Bedarf: pro Lied entstehen ~8 Einstellungen (Tonart, Kapo,
// Spalten, Schrift, Nur-Text, Abschnitte, Version, Anzeige-Quelle), je Version etwas mehr.
/** Höchstzahl Einstellungs-Einträge je Konto (~8 pro Lied ⇒ Platz für weit über 2000 Lieder). */
export const MAX_SETTINGS_PER_ACCOUNT = 20_000;
/** Höchstgröße der gesamten Einstellungs-Datei eines Kontos in Bytes (serialisiert). */
export const MAX_SETTINGS_BYTES_PER_ACCOUNT = 5 * 1024 * 1024; // 5 MB

/** Rein & testbar: Liegt ein Einstellungs-Store mit dieser Eintragszahl + Bytegröße im Rahmen? */
export function withinSettingsLimits(entryCount: number, totalBytes: number): boolean {
  return entryCount <= MAX_SETTINGS_PER_ACCOUNT && totalBytes <= MAX_SETTINGS_BYTES_PER_ACCOUNT;
}

/**
 * Erlaubte Einstellungs-Schlüssel – begrenzt, was synchronisiert wird.
 *
 * Aufbau: `worship_<feld>_<liedId>` plus optional der Versions-Schlüssel (`versionSlug` liefert
 * `[a-z0-9-]+`) und ein alter Geräte-Zusatz (`_dlarge`/`_dphone`, nur noch lesend). Der
 * **End-Anker** kam mit #215 dazu: Vorher passierte `worship_key_1<Müll>` den Filter und landete
 * als Müll in der Konto-Datei. Ausbrechen konnte damit nichts (Pfade entstehen nur aus der
 * numerischen `userId`, Größe und Anzahl sind gedeckelt) – aber sauber war es nicht.
 *
 * Die beiden erlaubten Zusätze sind Absicht: Ein strenges `_\d+$` würde die versionsbezogenen
 * Schlüssel **stillschweigend verwerfen** – die Einstellungen wären dann geräteübergreifend weg.
 * Liegt in @shared/keys und wird von Client UND Server geteilt (#250) – hier nur re-exportiert.
 */
import { SETTINGS_KEY_RE, SETTINGS_SONGID_RE } from '@shared/keys/index';
export { SETTINGS_KEY_RE };
/**
 * Lied-ID aus einem Einstellungs-Schlüssel ziehen.
 *
 * Muster aus `@shared/keys` – hier stand die Namensliste ein zweites Mal wortgleich, obwohl der
 * Kommentar über dem Import genau das Gegenteil behauptete. Beim Hinzufügen der Zählweise wurde
 * keine der beiden nachgezogen.
 */
function songIdOf(key: string): number | null {
  const m = key.match(SETTINGS_SONGID_RE);
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
  // Nur „Datei gibt es noch nicht" ist leer; jeder andere Lesefehler wirft (#273) – sonst landete ein
  // leerer Stand als Wahrheit im Cache und der nächste Schreibvorgang überschrieb die Einstellungen.
  const data = (await readJsonStore<Store>(fileFor(userId), 'Lied-Einstellungen')) ?? {};
  cache.set(userId, data);
  return data;
}

/**
 * `serialized` vermeidet doppeltes JSON.stringify, wenn der Aufrufer schon serialisiert hat.
 * Der Cache wird **erst nach** erfolgreichem Schreiben gesetzt (#273) – vorher zeigte er bei einem
 * Schreibfehler einen Stand, der nie auf der Platte lag. `putSettings` arbeitet ohnehin auf einer Kopie.
 */
async function write(userId: number, store: Store, serialized?: string): Promise<void> {
  await writeJsonStore(fileFor(userId), serialized ?? JSON.stringify(store));
  cache.set(userId, store);
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
export async function putSettings(
  userId: number,
  entries: Record<string, string | null>,
): Promise<void> {
  await withLock(userId, async () => {
    const store = await read(userId);
    // Auf einer KOPIE arbeiten und erst nach der Grenzprüfung übernehmen – sonst wäre der Store
    // (und der Cache) schon verändert, wenn wir abbrechen.
    const candidate: Store = { ...store };
    for (const [key, value] of Object.entries(entries)) {
      if (!SETTINGS_KEY_RE.test(key)) continue;
      if (value === null || value === '') delete candidate[key];
      else candidate[key] = String(value).slice(0, 4000);
    }
    const serialized = JSON.stringify(candidate);
    const count = Object.keys(candidate).length;
    const bytes = Buffer.byteLength(serialized);
    if (!withinSettingsLimits(count, bytes)) {
      // Über der Grenze wird NUR abgelehnt, was den Store wachsen lässt (#213). Sonst säße ein
      // Konto, dessen Datei schon vor Einführung der Grenzen zu groß war, in der Sackgasse: Auch
      // das Aufräumen bekäme 413, und nur ein Handeingriff auf dem Volume käme da raus.
      // (`annotations.ts` löst dasselbe über einen eigenen Löschzweig vor der Prüfung.)
      const prevCount = Object.keys(store).length;
      const prevBytes = Buffer.byteLength(JSON.stringify(store));
      if (count > prevCount || bytes > prevBytes) {
        throw new HttpError(
          413,
          'Speicher-Obergrenze für Lied-Einstellungen erreicht. Bitte nicht mehr benötigte Einstellungen zurücksetzen.',
        );
      }
    }
    await write(userId, candidate, serialized);
  });
}
