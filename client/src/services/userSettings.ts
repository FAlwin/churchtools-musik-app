/**
 * Server-Synchronisierung der Lied-/Versions-Einstellungen PRO KONTO (Tonart, Kapo, Spalten,
 * Schrift, Nur-Text, Abschnitte, gewählte Version, Anzeige-Quelle). localStorage bleibt der
 * schnelle Arbeitsspeicher; dieser Layer spiegelt vom/zum Server.
 */
import { apiFetch, ApiError } from './api';
import { getReachable } from './reachability';
import { SETTINGS_KEY_RE } from '@shared/keys/index';
import { createPendingKeys } from './pendingKeys';
import { onAppHidden } from './appHidden';

// Grammatik aus @shared/keys (#250) – Client und Server teilen sie jetzt wirklich.
const MIGRATED_FLAG = 'worship_settings_migrated_v1';

/**
 * Ausstehende Uploads überleben das Schließen der App (#275).
 *
 * Der Zwilling `annotations.ts` hatte das seit #256, hier fehlte es: Änderte jemand ohne Netz die
 * Tonart und wurde die App danach beendet (iOS macht das im Hintergrund von selbst), war beim
 * nächsten Start unbekannt, dass etwas fehlt – `pullSettings` spiegelte den älteren Server-Stand
 * zurück und die Änderung war **still weg**. Der Mechanismus liegt in `pendingKeys.ts`, damit es
 * nicht die dritte handgebaute Fassung wird.
 */
const pendingStore = createPendingKeys('worship_settings_pending_v1');

let disabled = false;

/** Sync nach erfolgreicher Anmeldung wieder einschalten – siehe `annotations.resetSync` (#211). */
export function resetSync(): void {
  disabled = false;
}

/** Server → localStorage: vorhandene Einstellungen dieser Lieder spiegeln (setzt nur vorhandene Werte). */
export async function pullSettings(songIds: number[]): Promise<void> {
  if (disabled || songIds.length === 0) return;
  try {
    const data = await apiFetch<Record<string, string>>(`/api/settings?songs=${songIds.join(',')}`);
    // Drei Gründe, einen Schlüssel NICHT zu überschreiben (#275):
    //  - `pending`: Änderung wartet noch auf ihren Upload
    //  - `inflight`: Upload läuft gerade – der Server kennt den neuen Wert noch nicht
    //  - Merker aus localStorage: nach einem Neustart ist die Speicher-Warteschlange leer, die
    //    Einstellung aber weiterhin nicht hochgeladen. Ohne diese Prüfung gewinnt der alte Stand.
    const stillPending = pendingStore.read();
    for (const [k, v] of Object.entries(data)) {
      if (pending.has(k) || inflight.has(k) || stillPending.has(k)) continue;
      if (SETTINGS_KEY_RE.test(k)) localStorage.setItem(k, v);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  }
}

// Änderungen gebündelt schreiben (mehrere Einstellungen in einem PUT).
const pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;
// Schlüssel, deren Upload gerade LÄUFT – solange darf ein paralleler Pull sie nicht mit dem
// (noch alten) Server-Stand überschreiben. Vorher wurde `pending` VOR dem Request geleert, ein
// gleichzeitig laufender 30-s-Pull sah also nichts und drehte die frische Einstellung zurück (#275).
const inflight = new Set<string>();

/**
 * Meldet dem Nutzer, dass Einstellungen NICHT gespeichert werden konnten (#213). Registriert wird
 * der Handler in `App.tsx` (Toast) – vorher verschwand eine abgelehnte Einstellung spurlos.
 */
let syncErrorHandler: ((msg: string) => void) | null = null;
export function setSettingsSyncErrorHandler(fn: ((msg: string) => void) | null): void {
  syncErrorHandler = fn;
}

async function flush(keepalive = false): Promise<void> {
  timer = null;
  if (disabled || pending.size === 0) return;
  // Stapel herausnehmen, aber bei einem vorübergehenden Fehler zurücklegen (#213): Vorher wurde
  // `pending` VOR dem Request geleert – schlug er fehl, war die Einstellung still weg.
  const batch = new Map(pending);
  pending.clear();
  for (const k of batch.keys()) inflight.add(k);
  try {
    await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(Object.fromEntries(batch)),
      // keepalive: Request überlebt das Backgrounding der Seite (App-Wechsel/Schließen) – #275.
      ...(keepalive ? { keepalive: true } : {}),
    });
    for (const k of batch.keys()) pendingStore.unmark(k); // durch – der Merker darf weg (#275)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      disabled = true;
      return;
    }
    if (e instanceof ApiError && e.status === 413) {
      // Konto-Obergrenze erreicht: Ein erneuter Versuch würde genauso scheitern → nicht
      // zurücklegen, aber sagen, was los ist (lokal gilt die Einstellung weiter).
      // Merker ebenfalls weg, sonst versucht es jeder App-Start erneut (wie #256 bei den Anmerkungen).
      for (const k of batch.keys()) pendingStore.unmark(k);
      syncErrorHandler?.(e.message);
      return;
    }
    // Netz-/Serverfehler: zurücklegen, damit nichts verloren geht – neuere Werte gewinnen.
    // Die Merker bleiben stehen: Wird die App jetzt geschlossen, holt `resumePendingSettings` es nach.
    for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v);
    // Nur erneut ansetzen, wenn der Server grundsätzlich erreichbar ist; sonst wartet der Stapel
    // auf die nächste Änderung (statt im Offline-Fall alle paar Sekunden vergeblich zu funken).
    if (getReachable() && !timer) timer = setTimeout(() => void flush(), 5000);
  } finally {
    for (const k of batch.keys()) inflight.delete(k);
  }
}

/**
 * Alle noch ausstehenden Einstellungen SOFORT abschicken – beim Verlassen/Backgrounding der App (#275).
 *
 * Ohne das friert iOS den 600-ms-Debounce-Timer ein: Wer die Tonart ändert und die App gleich
 * weg-wischt, verliert die Änderung, weil der Timer nie wieder feuert. Die Anmerkungen haben diese
 * Behandlung seit #193/#256 – den Einstellungen fehlte sie.
 */
export function flushPendingSettings(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  void flush(true);
}

onAppHidden(flushPendingSettings);

/**
 * Beim Start: Uploads nachholen, die beim letzten Mal nicht durchgingen (#275).
 *
 * MUSS vor dem ersten `pullSettings` laufen – sonst überschreibt der Pull genau die Einstellungen,
 * die hier noch hochzuladen sind. Der Wert kommt aus dem localStorage; fehlt er dort, war es ein
 * **Entfernen** (`null`) und genau das wird nachgeholt.
 */
export async function resumePendingSettings(): Promise<void> {
  if (disabled) return;
  const keys = pendingStore.read();
  if (keys.size === 0) return;
  for (const key of keys) {
    if (!SETTINGS_KEY_RE.test(key)) {
      pendingStore.unmark(key); // Altlast/Unsinn – nicht endlos mitschleppen
      continue;
    }
    pending.set(key, localStorage.getItem(key));
  }
  await flush();
}

/** Eine geänderte Einstellung zum Server schreiben (debounced, gebündelt). null/'' = entfernen. */
export function pushSetting(key: string, value: string | null): void {
  if (disabled || !SETTINGS_KEY_RE.test(key)) return;
  pending.set(key, value);
  pendingStore.mark(key); // übersteht das Schließen der App (#275)
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 600);
}

/** Einmalig: bestehende lokale Einstellungen aufs Konto hochladen (danach Merker gesetzt). */
export async function migrateLocalSettings(): Promise<void> {
  if (disabled || localStorage.getItem(MIGRATED_FLAG)) return;
  const body: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && SETTINGS_KEY_RE.test(k)) {
      const v = localStorage.getItem(k);
      if (v != null) body[k] = v;
    }
  }
  if (Object.keys(body).length === 0) {
    localStorage.setItem(MIGRATED_FLAG, '1');
    return;
  }
  try {
    await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
    localStorage.setItem(MIGRATED_FLAG, '1');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
    // sonst: Merker NICHT setzen → nächster Versuch beim nächsten Laden
  }
}
