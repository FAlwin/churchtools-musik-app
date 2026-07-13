/**
 * Team-Notizen nach dem PCO-Modell: eigene Anmerkungen wahlweise TEILEN; geteilte Ebenen
 * anderer ANSEHEN (schreibgeschützt, in deren Ansicht) und optional übernehmen (Import).
 * Anmerkungen selbst bleiben strikt pro Konto (services/annotations.ts).
 */
import { apiFetch } from './api';
// SharedPage (fremde Anmerkungsebene) kommt aus @shared/types – re-exportiert für Bestandsimporte.
import type { SharedPage } from '@shared/types/index';

export type { SharedPage };

/** localStorage-Namensraum für die gerade ANGESEHENE fremde Ebene (flüchtiger Spiegel). */
export const VIEW_NS = 'worship_teamview_';

export interface Sharer {
  id: number;
  name: string;
  /** Lieder (aus der Anfrage), zu denen diese Person Anmerkungen hat. */
  songs: number[];
}

/** Teilt mein Konto seine Anmerkungen gerade? */
export function getSharing(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/api/annotations/sharing');
}

/** Eigenes Teilen ein-/ausschalten. */
export function setSharing(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/api/annotations/sharing', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

/** Wer teilt Anmerkungen zu diesen Liedern? (eigenes Konto ist ausgenommen) */
export function getSharers(songIds: number[]): Promise<Sharer[]> {
  return apiFetch<Sharer[]>(`/api/annotations/sharers?songs=${songIds.join(',')}`);
}

/** Geteilte Anmerkungen einer Person (Schlüssel `song<id>_v<version>_<seite>`, ohne Zoom). */
export function getAnnotationsOf(
  personId: number,
  songIds: number[],
): Promise<Record<string, SharedPage>> {
  return apiFetch<Record<string, SharedPage>>(
    `/api/annotations/of/${personId}?songs=${songIds.join(',')}`,
  );
}

/** Lied-Einstellungen einer teilenden Person (worship_*-Schlüssel) – für deren Ansicht. */
export function getSettingsOf(personId: number, songIds: number[]): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>(`/api/settings/of/${personId}?songs=${songIds.join(',')}`);
}

/** Räumt den flüchtigen Ansichts-Spiegel (beim Beenden des Ansehens/Personenwechsel). */
export function clearViewMirror(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(VIEW_NS)) localStorage.removeItem(k);
  }
}

/** Spiegelt die geteilte Ebene einer Person in den Ansichts-Namensraum (für PageDeck). */
export async function loadViewMirror(personId: number, songIds: number[]): Promise<void> {
  const data = await getAnnotationsOf(personId, songIds);
  clearViewMirror();
  for (const [key, page] of Object.entries(data)) {
    if (page.strokes) localStorage.setItem(VIEW_NS + key, page.strokes);
    if (page.texts && page.texts.length) {
      localStorage.setItem(`${VIEW_NS + key}_text`, JSON.stringify(page.texts));
    }
  }
}
