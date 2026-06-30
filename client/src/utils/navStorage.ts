import type { TabId } from '../components/TabBar';

/** Eine gepushte Vollbild-Ansicht über der Tab-Ebene (Ablauf oder Lied-Anzeige). */
export type View = null | { type: 'setlist' } | { type: 'chart'; source: 'setlist' | 'lieder' };

// ── Wiederherstellung der letzten Ansicht (gegen iOS-PWA-Kaltstart) ──
// iOS verwirft eine installierte PWA beim Wegwechseln oft aus dem Speicher; die Rückkehr ist ein
// Kaltstart. Wir können das nicht verhindern, machen es aber unsichtbar: den letzten Stand sichern
// und beim Start wiederherstellen.
const NAV_KEY = 'worship:nav-v1';
// Lebensdauer des gespeicherten Stands: überlebt ein Recycling (Minuten/Stunden),
// startet aber nicht Tage später noch im alten Lied.
const NAV_TTL_MS = 1000 * 60 * 60 * 8;

export interface PersistedNav {
  tab: TabId;
  view: View;
  serviceId: number | null;
  songIndex: number;
  libSel: { songId: number; arrangementId?: number } | null;
  savedAt: number;
}

export function loadNav(): PersistedNav | null {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedNav;
    if (typeof p?.savedAt !== 'number' || Date.now() - p.savedAt > NAV_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveNav(nav: PersistedNav): void {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify(nav));
  } catch {
    // Speicher nicht verfügbar – Wiederherstellung entfällt dann eben
  }
}

export function clearNav(): void {
  try {
    localStorage.removeItem(NAV_KEY);
  } catch {
    // ignorieren
  }
}
