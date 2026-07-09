/**
 * Server-Synchronisierung der Lied-/Versions-Einstellungen PRO KONTO (Tonart, Kapo, Spalten,
 * Schrift, Nur-Text, Abschnitte, gewählte Version, Anzeige-Quelle). localStorage bleibt der
 * schnelle Arbeitsspeicher; dieser Layer spiegelt vom/zum Server.
 */
import { apiFetch, ApiError } from './api';

// `shared` = Sichtbarkeit der Team-Anmerkungsebene pro Lied ('0' = ausgeblendet; fehlend = an).
const SETTINGS_KEY_RE = /^worship_(?:key|capo|cols|fs|lyrics|secshift|ver|view|shared)_\d+/;
const MIGRATED_FLAG = 'worship_settings_migrated_v1';

let disabled = false;

/** Server → localStorage: vorhandene Einstellungen dieser Lieder spiegeln (setzt nur vorhandene Werte). */
export async function pullSettings(songIds: number[]): Promise<void> {
  if (disabled || songIds.length === 0) return;
  try {
    const data = await apiFetch<Record<string, string>>(`/api/settings?songs=${songIds.join(',')}`);
    for (const [k, v] of Object.entries(data)) {
      // Gerade geänderte (noch nicht hochgeladene) Einstellungen nicht überschreiben.
      if (pending.has(k)) continue;
      if (SETTINGS_KEY_RE.test(k)) localStorage.setItem(k, v);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  }
}

// Änderungen gebündelt schreiben (mehrere Einstellungen in einem PUT).
const pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  timer = null;
  if (disabled || pending.size === 0) return;
  const body = Object.fromEntries(pending);
  pending.clear();
  try {
    await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  }
}

/** Eine geänderte Einstellung zum Server schreiben (debounced, gebündelt). null/'' = entfernen. */
export function pushSetting(key: string, value: string | null): void {
  if (disabled || !SETTINGS_KEY_RE.test(key)) return;
  pending.set(key, value);
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
