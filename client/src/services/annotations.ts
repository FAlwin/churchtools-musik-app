/**
 * Server-Synchronisierung der Anmerkungen (Striche + Textfelder + Zoom) PRO KONTO.
 * localStorage bleibt der schnelle Arbeits-/Offline-Cache; dieser Layer spiegelt vom/zum Server:
 *  - pullAnnotations(): Server → localStorage (beim Öffnen einer Setlist)
 *  - pushField(): localStorage-Änderung → Server (gebündelt/debounced, Feld-Merge)
 *  - migrateLocalAnnotations(): einmalig bestehende Geräte-Anmerkungen aufs Konto hochladen
 */
import { apiFetch, ApiError } from './api';
import type { AnnotationText, PageAnnotation } from '@shared/types/index';

const DRAW = 'worship_docdraw_';
const ZOOM = 'worship_doczoom_';
const MIGRATED_FLAG = 'worship_anno_migrated_v1';
// Gültige Server-Schlüssel: song<id>_v<version>[_lyr]_<seite> (+ optional _d<geräteklasse><spalten>
// beim Zoom, z. B. _dlarge2 im iPad-Querformat). `_lyr` = eigene Notiz-Ebene der Darstellungsart
// „Nur Text" (ohne = „Akkorde & Text", abwärtskompatibel zu Bestandsnotizen). Andere Schlüssel
// (z. B. Dokument-fileId-Keys) bleiben lokal. Die abschließende Layout-Ziffer (1 = Hochformat,
// 2 = Querformat/2-up) MUSS erlaubt sein, sonst wird der Querformat-Zoom nie zum Server gepusht.
export const KEY_RE = /^song\d+_v[a-z0-9-]+(?:_lyr)?_\d+(?:_d(?:phone|large)\d?)?$/i;

// Anmerkungs-Typen (AnnotationText, PageAnnotation) kommen aus @shared/types – einzige Quelle
// für Client + Server, damit beim Server-Roundtrip kein Feld verloren geht.

// Sync abschalten, wenn nicht angemeldet (Demo / 401) – dann bleibt alles rein lokal.
let disabled = false;

/** localStorage-Key → Server-Eintrags-Schlüssel (song<id>_v<version>_<seite>). */
function serverKeyOf(lsKey: string): string {
  return lsKey.replace(DRAW, '').replace(ZOOM, '').replace(/_text$/, '');
}

/** Alte (versionslose) Schlüssel auf das neue Schema heben: song12_3 → song12_voriginal_3. */
function normalizeKey(key: string): string {
  if (KEY_RE.test(key)) return key;
  const m = key.match(/^song(\d+)_(\d+)$/);
  return m ? `song${m[1]}_voriginal_${m[2]}` : key;
}

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── Pull: Server → localStorage ──────────────────────────────
/** Holt alle Anmerkungen des Kontos zu diesen Liedern und spiegelt sie in localStorage. */
export async function pullAnnotations(songIds: number[]): Promise<void> {
  if (disabled || songIds.length === 0) return;
  try {
    const data = await apiFetch<Record<string, PageAnnotation>>(`/api/annotations?songs=${songIds.join(',')}`);
    for (const [key, a] of Object.entries(data)) {
      // Seiten mit noch nicht hochgeladener ODER gerade hochladender lokaler Änderung NICHT
      // überschreiben (sonst gehen frische Anmerkungen/Zooms an den alten Server-Stand verloren).
      if (pendingFields.has(key) || inflight.has(key)) continue;
      if (a.strokes) localStorage.setItem(DRAW + key, a.strokes);
      else localStorage.removeItem(DRAW + key);
      if (a.texts && a.texts.length) localStorage.setItem(DRAW + key + '_text', JSON.stringify(a.texts));
      else localStorage.removeItem(DRAW + key + '_text');
      if (a.zoom) localStorage.setItem(ZOOM + key, JSON.stringify(a.zoom));
      else localStorage.removeItem(ZOOM + key);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  }
}

// ── Push: localStorage-Änderung → Server (gebündelt) ─────────
const pendingFields = new Map<string, PageAnnotation>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// Schlüssel, deren Upload gerade LÄUFT – solange darf ein paralleler Pull den lokalen Stand
// nicht mit dem (noch alten) Server-Stand überschreiben.
const inflight = new Set<string>();

async function flush(key: string, keepalive = false): Promise<void> {
  const body = pendingFields.get(key);
  pendingFields.delete(key);
  timers.delete(key);
  if (!body || disabled) return;
  inflight.add(key);
  try {
    await apiFetch(`/api/annotations/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      // keepalive: Request überlebt das Backgrounding der Seite (App-Wechsel/Schließen).
      ...(keepalive ? { keepalive: true } : {}),
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  } finally {
    inflight.delete(key);
  }
}

/** Alle noch ausstehenden Uploads SOFORT abschicken – beim Verlassen/Backgrounding der App.
 *  Ohne das friert iOS die 600-ms-Debounce-Timer ein und ein gerade gesetzter Zoom erreicht
 *  den Server nie („Zoom bleibt nicht gespeichert" nach App-Neustart). */
export function flushPendingAnnotations(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const key of [...pendingFields.keys()]) void flush(key, true);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingAnnotations();
  });
  window.addEventListener('pagehide', flushPendingAnnotations);
}

/** Eine Feld-Änderung (strokes/texts/zoom) einer Seite zum Server schreiben (debounced, Feld-Merge). */
export function pushField(lsKey: string, field: keyof PageAnnotation, value: unknown): void {
  if (disabled) return;
  const key = serverKeyOf(lsKey);
  if (!KEY_RE.test(key)) return; // nur Lied-Seiten synchronisieren (Dokumente bleiben lokal)
  const cur = pendingFields.get(key) ?? {};
  (cur as Record<string, unknown>)[field] = value;
  pendingFields.set(key, cur);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => void flush(key), 600));
}

// ── Migration: bestehende Geräte-Anmerkungen einmalig aufs Konto ──
/** Lädt vorhandene lokale Anmerkungen einmalig aufs Konto (danach gesetzter Merker). */
export async function migrateLocalAnnotations(): Promise<void> {
  if (disabled || localStorage.getItem(MIGRATED_FLAG)) return;
  const entries: Record<string, PageAnnotation> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(DRAW)) {
      if (k.endsWith('_text')) {
        const sk = normalizeKey(k.slice(0, -'_text'.length).replace(DRAW, ''));
        const texts = safeJson<AnnotationText[]>(localStorage.getItem(k));
        if (texts && texts.length) (entries[sk] ??= {}).texts = texts;
      } else {
        const sk = normalizeKey(k.replace(DRAW, ''));
        const strokes = localStorage.getItem(k);
        if (strokes) (entries[sk] ??= {}).strokes = strokes;
      }
    } else if (k.startsWith(ZOOM)) {
      const base = k.replace(ZOOM, '');
      if (/^p\d+$/.test(base)) continue; // alte seiten-globale Zoom-Keys ignorieren
      const sk = normalizeKey(base);
      const zoom = safeJson<{ x: number; y: number; scale: number }>(localStorage.getItem(k));
      if (zoom) (entries[sk] ??= {}).zoom = zoom;
    }
  }
  // Nur gültige Lied-Schlüssel hochladen (Dokument-Anmerkungen bleiben lokal).
  const keys = Object.keys(entries).filter((k) => KEY_RE.test(k));
  // Pro Schlüssel hochladen (kleine Requests, einmaliger Vorgang); Einzelfehler überspringen.
  for (const key of keys) {
    try {
      await apiFetch(`/api/annotations/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify(entries[key]),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        disabled = true;
        return; // nicht angemeldet → Merker NICHT setzen, später erneut versuchen
      }
      // anderer Fehler (z. B. zu groß): diesen Schlüssel überspringen
    }
  }
  localStorage.setItem(MIGRATED_FLAG, '1');
}
