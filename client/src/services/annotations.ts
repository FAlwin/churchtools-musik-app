/**
 * Server-Synchronisierung der Anmerkungen (Striche + Textfelder + Zoom) PRO KONTO.
 * localStorage bleibt der schnelle Arbeits-/Offline-Cache; dieser Layer spiegelt vom/zum Server:
 *  - pullAnnotations(): Server → localStorage (beim Öffnen einer Setlist)
 *  - pushField(): localStorage-Änderung → Server (gebündelt/debounced, Feld-Merge)
 *  - migrateLocalAnnotations(): einmalig bestehende Geräte-Anmerkungen aufs Konto hochladen
 *
 *  - resumePendingAnnotations(): beim Start nachholen, was beim letzten Mal nicht durchging (#256)
 *
 * **Zwei Ebenen der Absicherung gegen verlorene Anmerkungen:** Innerhalb einer Sitzung wird ein
 * fehlgeschlagener Upload zurückgelegt und wiederholt (#245); über einen App-Neustart hinweg trägt der
 * Merker `worship_anno_pending_v1` in localStorage die offenen Schlüssel (#256). Beide Wege schützen
 * dieselbe Stelle: `pullAnnotations` darf eine Seite mit ausstehendem Upload NICHT überschreiben.
 */
import { apiFetch, ApiError } from './api';
import { getReachable } from './reachability';
import { createPendingKeys } from './pendingKeys';
import { onAppHidden } from './appHidden';
import {
  ANNO_DRAW_NS,
  ANNO_ZOOM_NS,
  ANNO_KEY_RE,
  normalizeAnnoKey as normalizeKey,
} from '@shared/keys/index';
import type { AnnotationText, PageAnnotation } from '@shared/types/index';

// Namensräume und Grammatik aus @shared/keys – EINZIGE Quelle für Client und Server (#250).
const DRAW = ANNO_DRAW_NS;
const ZOOM = ANNO_ZOOM_NS;
const MIGRATED_FLAG = 'worship_anno_migrated_v1';
// Die Grammatik liegt in @shared/keys (#250) – hier nur re-exportiert, damit Bestandsimporte
// (`services/annotations`.KEY_RE) weiter funktionieren.
export const KEY_RE = ANNO_KEY_RE;

// Anmerkungs-Typen (AnnotationText, PageAnnotation) kommen aus @shared/types – einzige Quelle
// für Client + Server, damit beim Server-Roundtrip kein Feld verloren geht.

// Sync abschalten, wenn nicht angemeldet (Demo / 401) – dann bleibt alles rein lokal.
let disabled = false;

/**
 * Sync wieder einschalten – MUSS nach jeder erfolgreichen Anmeldung passieren (#211). Ohne das
 * blieb `disabled` nach einem automatischen Abmelden für den Rest der Seiten-Lebensdauer stehen:
 * Anmerkungen wurden dann nur noch lokal gespeichert und gingen geräteübergreifend still verloren.
 */
export function resetSync(): void {
  disabled = false;
}

/** localStorage-Key → Server-Eintrags-Schlüssel (song<id>_v<version>_<seite>). */
function serverKeyOf(lsKey: string): string {
  return lsKey
    .replace(DRAW, '')
    .replace(ZOOM, '')
    .replace(/_text$/, '');
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
    const data = await apiFetch<Record<string, PageAnnotation>>(
      `/api/annotations?songs=${songIds.join(',')}`,
    );
    // Der Merker aus localStorage zählt mit (#256): Nach einem Neustart ist die Speicher-Warteschlange
    // leer, die Seite aber weiterhin nicht hochgeladen – ohne diese Prüfung gewinnt der alte Stand.
    const stillPending = pendingStore.read();
    for (const [key, a] of Object.entries(data)) {
      // Seiten mit noch nicht hochgeladener ODER gerade hochladender lokaler Änderung NICHT
      // überschreiben (sonst gehen frische Anmerkungen/Zooms an den alten Server-Stand verloren).
      if (pendingFields.has(key) || inflight.has(key) || stillPending.has(key)) continue;
      if (a.strokes) localStorage.setItem(DRAW + key, a.strokes);
      else localStorage.removeItem(DRAW + key);
      if (a.texts && a.texts.length)
        localStorage.setItem(DRAW + key + '_text', JSON.stringify(a.texts));
      else localStorage.removeItem(DRAW + key + '_text');
      if (a.zoom) localStorage.setItem(ZOOM + key, JSON.stringify(a.zoom));
      else localStorage.removeItem(ZOOM + key);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) disabled = true;
  }
}

// ── Ausstehende Uploads: überleben das Schließen der App (#256) ──────────────
/**
 * Schlüssel, deren Upload noch aussteht – **in localStorage**, damit er einen App-Neustart übersteht.
 *
 * Vorher lebte die Warteschlange nur im Speicher: Zeichnete jemand offline und wurde die App danach
 * beendet, war beim nächsten Start nicht mehr bekannt, dass etwas fehlt – der erste `pullAnnotations`
 * spiegelte den älteren Server-Stand über den lokalen und der Strich verschwand sichtbar.
 *
 * Gespeichert werden nur die SCHLÜSSEL; die Anmerkung selbst liegt ohnehin im localStorage.
 */
// Der Mechanismus liegt in `pendingKeys.ts` – die Einstellungen brauchen ihn genauso (#275).
const pendingStore = createPendingKeys('worship_anno_pending_v1');

/**
 * Die Anmerkung eines Schlüssels aus dem localStorage zusammensetzen.
 *
 * Von der Wiederaufnahme UND der einmaligen Migration genutzt – vorher baute die Migration das
 * gleiche Objekt selbst zusammen (dieselbe Fehlerklasse, die dieses Projekt mehrfach getroffen hat).
 */
function annotationFromStorage(key: string): PageAnnotation | null {
  const out: PageAnnotation = {};
  const strokes = localStorage.getItem(DRAW + key);
  if (strokes) out.strokes = strokes;
  const texts = safeJson<AnnotationText[]>(localStorage.getItem(DRAW + key + '_text'));
  if (texts && texts.length) out.texts = texts;
  const zoom = safeJson<{ x: number; y: number; scale: number }>(localStorage.getItem(ZOOM + key));
  if (zoom) out.zoom = zoom;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Beim Start: Uploads nachholen, die beim letzten Mal nicht durchgingen (#256).
 *
 * MUSS vor dem ersten `pullAnnotations` laufen – sonst überschreibt der Pull genau die Seiten, die
 * hier noch hochzuladen sind. Ein Schlüssel ohne lokale Daten (Anmerkung wurde inzwischen gelöscht)
 * wird nur aus dem Merker entfernt.
 */
export async function resumePendingAnnotations(): Promise<void> {
  if (disabled) return;
  for (const key of pendingStore.read()) {
    const body = annotationFromStorage(key);
    if (!body) {
      pendingStore.unmark(key);
      continue;
    }
    pendingFields.set(key, body);
    await flush(key);
  }
}

// ── Push: localStorage-Änderung → Server (gebündelt) ─────────
const pendingFields = new Map<string, PageAnnotation>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// Schlüssel, deren Upload gerade LÄUFT – solange darf ein paralleler Pull den lokalen Stand
// nicht mit dem (noch alten) Server-Stand überschreiben.
const inflight = new Set<string>();

/**
 * Meldet dem Nutzer, dass eine Anmerkung NICHT gespeichert werden konnte (#245). Registriert wird der
 * Handler in `App.tsx` (Toast) – wie der Zwilling für die Einstellungen (#213).
 */
let syncErrorHandler: ((msg: string) => void) | null = null;
export function setAnnotationsSyncErrorHandler(fn: ((msg: string) => void) | null): void {
  syncErrorHandler = fn;
}

/**
 * Ein Problem mit den Anmerkungen melden – nutzt denselben Kanal wie die Sync-Fehler (#251).
 * Gedacht für Fälle, die außerhalb dieses Moduls auffallen, z. B. ein voller Gerätespeicher.
 */
export function reportAnnotationProblem(msg: string): void {
  syncErrorHandler?.(msg);
}

/**
 * Einen fehlgeschlagenen Stand zurück in die Warteschlange legen (#245).
 *
 * Feld-weise, und **neuere Werte gewinnen**: Hat der Nutzer während des laufenden Requests weiter
 * gezeichnet, steht das neue `strokes` schon in der Warteschlange – es darf nicht vom alten
 * überschrieben werden. Ergänzt werden nur Felder, die inzwischen NICHT neu gesetzt wurden.
 */
function requeue(key: string, body: PageAnnotation): void {
  const current = pendingFields.get(key);
  if (!current) {
    pendingFields.set(key, body);
    return;
  }
  for (const [field, value] of Object.entries(body)) {
    if (!(field in current)) (current as Record<string, unknown>)[field] = value;
  }
}

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
    pendingStore.unmark(key); // durch – der Merker darf weg (#256)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      disabled = true;
      return;
    }
    if (e instanceof ApiError && e.status === 413) {
      // Konto-Obergrenze erreicht (#139): ein erneuter Versuch würde genauso scheitern → nicht
      // zurücklegen, aber sagen, was los ist (lokal bleibt die Anmerkung erhalten).
      pendingStore.unmark(key); // endgültig – sonst versucht es jeder Start erneut (#256)
      syncErrorHandler?.(e.message);
      return;
    }
    // Netz-/Serverfehler: zurücklegen, sonst ist die Anmerkung weg (#245). Vorher wurde der Eintrag
    // VOR dem Request entnommen und im Fehlerfall nicht zurückgelegt – danach überschrieb der nächste
    // `pullAnnotations` den lokalen Stand mit dem älteren Server-Stand und der Strich verschwand
    // sichtbar. (Dieselbe Lehre hatte `userSettings.ts` unter #213 schon gezogen.)
    requeue(key, body);
    // Nur erneut ansetzen, wenn der Server grundsätzlich erreichbar ist – sonst wartet der Eintrag
    // auf die nächste Änderung bzw. auf `flushPendingAnnotations` beim Verlassen der App, statt
    // offline alle paar Sekunden vergeblich zu funken.
    if (getReachable() && !timers.has(key)) {
      timers.set(
        key,
        setTimeout(() => void flush(key), 5000),
      );
    }
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

onAppHidden(flushPendingAnnotations);

/** Eine Feld-Änderung (strokes/texts/zoom) einer Seite zum Server schreiben (debounced, Feld-Merge). */
export function pushField(lsKey: string, field: keyof PageAnnotation, value: unknown): void {
  if (disabled) return;
  const key = serverKeyOf(lsKey);
  if (!KEY_RE.test(key)) return; // nur Lied-Seiten synchronisieren (Dokumente bleiben lokal)
  const cur = pendingFields.get(key) ?? {};
  (cur as Record<string, unknown>)[field] = value;
  pendingFields.set(key, cur);
  pendingStore.mark(key); // übersteht das Schließen der App (#256)
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => void flush(key), 600),
  );
}

// ── Migration: bestehende Geräte-Anmerkungen einmalig aufs Konto ──
/** Lädt vorhandene lokale Anmerkungen einmalig aufs Konto (danach gesetzter Merker). */
export async function migrateLocalAnnotations(): Promise<void> {
  if (disabled || localStorage.getItem(MIGRATED_FLAG)) return;
  // Alle Ebenen-Schlüssel im Speicher finden; die Anmerkung selbst baut `annotationFromStorage`
  // (dieselbe Funktion wie bei der Wiederaufnahme – nicht ein zweites Mal zusammengesetzt, #256).
  // Die ORIGINAL-Schlüssel sammeln (so, wie sie im Speicher stehen) – gelesen wird darunter, und
  // erst beim Hochladen wird auf das aktuelle Schema gehoben. Umgekehrt fände `annotationFromStorage`
  // nichts: Bei einem Altbestand liegen die Daten unter `song12_3`, nicht unter `song12_voriginal_3`.
  const found = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(DRAW)) {
      found.add(k.slice(DRAW.length).replace(/_text$/, ''));
    } else if (k.startsWith(ZOOM)) {
      const base = k.slice(ZOOM.length);
      if (/^p\d+$/.test(base)) continue; // alte seiten-globale Zoom-Keys ignorieren
      found.add(base);
    }
  }
  const entries: Record<string, PageAnnotation> = {};
  for (const raw of found) {
    const body = annotationFromStorage(raw);
    if (!body) continue;
    const ziel = normalizeKey(raw);
    // Sollten Alt- und Neuschlüssel derselben Seite beide existieren, gewinnt Feld für Feld der
    // zuerst gefundene – die Felder werden zusammengelegt statt einander zu verwerfen.
    entries[ziel] = { ...body, ...(entries[ziel] ?? {}) };
  }
  // Nur gültige Lied-Schlüssel hochladen (Dokument-Anmerkungen bleiben lokal).
  const keys = Object.keys(entries).filter((k) => KEY_RE.test(k));
  // Netzbedingter Fehlschlag = später nochmal versuchen. Der Merker darf dann NICHT fallen (#246):
  // Der Vorgang läuft genau einmal pro Gerät – wurde er bei schlechtem Netz „erledigt", landen die
  // bestehenden Geräte-Anmerkungen NIE auf dem Konto, still und ohne Meldung. Vorher wurde der
  // Merker bedingungslos gesetzt und nur 401 brach vorzeitig ab.
  let retryLater = false;
  // Pro Schlüssel hochladen (kleine Requests, einmaliger Vorgang).
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
      if (e instanceof ApiError && e.status === 413) {
        // Zu groß fürs Konto: ein erneuter Versuch scheitert genauso → diesen Schlüssel endgültig
        // überspringen (lokal bleibt er erhalten) und den Vorgang trotzdem abschließen.
        syncErrorHandler?.(e.message);
        continue;
      }
      retryLater = true; // Netz-/Serverfehler → nächster Start versucht es erneut
    }
  }
  if (!retryLater) localStorage.setItem(MIGRATED_FLAG, '1');
}
