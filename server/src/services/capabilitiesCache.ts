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
import { config } from '../config.js';
import type { UserCapabilities } from '@shared/types/index';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

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

/**
 * Liest die Ablage über `jsonStore` (#404). Nur „Datei gibt es nicht" heißt leer; jeder andere
 * Lesefehler WIRFT – und dann wird hier nichts zwischengespeichert. Vorher wurde „leer" als Wahrheit
 * übernommen und beim nächsten Merken zurückgeschrieben: Der Rechte-Cache ALLER Konten war weg.
 * Genau dagegen wurde `jsonStore` gebaut (#273), und sein Kopfkommentar nannte diese Ablage schon –
 * umgestellt war sie trotzdem nie.
 */
async function load(): Promise<Store> {
  if (store) return store;
  store = (await readJsonStore<Store>(config.capabilitiesCachePath, 'Rechte-Cache')) ?? {};
  return store;
}

/**
 * Rechte, die **NIE** aus dem Cache überbrückt werden (#249, #282).
 *
 * Der Cache soll einen ChurchTools-Aussetzer von Sekunden bei den EIGENEN Lese-/Bearbeitungsrechten
 * überbrücken (Setlist sehen, Ablauf bearbeiten). Zwei Rechte fallen bewusst heraus, weil sie Zugriff
 * auf FREMDE Daten bzw. auf die Verwaltung geben – dort ist der konservative Weg richtig, lieber kurz
 * zu wenig als zu lange zu viel:
 *  - `isAdmin`: schreibende Verwaltungs-Endpunkte (`PUT /api/site-config`, Gruppen-/Rollen-Zuweisung).
 *  - `canUseGlobalNotes`: **Lesezugriff auf die Anmerkungen ANDERER Personen** (`teamNotesController`).
 *    Wird jemand aus der Musiker-Gruppe entfernt, dessen Sitzung aber noch läuft, könnte er sonst bis
 *    zu 12 h weiter fremde Notizen lesen. War in #249 übersehen worden (nur `isAdmin` abgedeckt).
 *
 * Die übrigen Rechte (`canViewSongs/Agendas`, `canEdit…`) betreffen geteilte Gemeinde-Inhalte, die der
 * Nutzer ohnehin sehen darf – die zu überbrücken ist genau der Zweck des Caches.
 *
 * Wer künftig ein Recht ergänzt, das FREMDE Daten freigibt, trägt es hier ein. Die Regel sitzt hier
 * und nicht beim Aufrufer, damit sie auch für einen zweiten Aufrufer gilt.
 */
const NEVER_BRIDGED: Partial<UserCapabilities> = { isAdmin: false, canUseGlobalNotes: false };

/**
 * Zuletzt gültige Rechte des Kontos – nur, wenn vorhanden UND nicht zu alt. Sonst `null`.
 * Die sensiblen Rechte (siehe `NEVER_BRIDGED`) werden dabei ausdrücklich auf `false` gesetzt.
 */
export async function getCachedCapabilities(
  userId: number,
  now = Date.now(),
): Promise<UserCapabilities | null> {
  let s: Store;
  try {
    s = await load();
  } catch {
    return null; // Ablage nicht lesbar → nichts zu überbrücken; die Anfrage läuft ohne Cache weiter
  }
  const entry = s[String(userId)];
  if (!entry || !isCacheFresh(entry.savedAt, now)) return null;
  return { ...entry.caps, ...NEVER_BRIDGED };
}

/** Merkt sich die (gültigen) Rechte des Kontos. Best effort – Schreibfehler werden geschluckt. */
export async function rememberCapabilities(
  userId: number,
  caps: UserCapabilities,
  now = Date.now(),
): Promise<void> {
  let s: Store;
  try {
    s = await load();
  } catch {
    // NICHT schreiben: Ein Stand aus einem gescheiterten Lesen enthielte nur dieses eine Konto und
    // überschriebe die Rechte aller anderen (#404). Die Datei bleibt, wie sie ist.
    return;
  }
  s[String(userId)] = { caps, savedAt: now };
  const write = (): Promise<void> =>
    writeJsonStore(config.capabilitiesCachePath, JSON.stringify(s));
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
