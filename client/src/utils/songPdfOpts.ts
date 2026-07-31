import type { SetlistSong } from '@shared/types/index';
import type { ChordPdfOptions } from './chordPdf';
import { loadSettings } from './chartSettings';
import { pdfOptionsForSong } from './chartPdfOptions';
import { selectedVersionKey } from './songVersions';

/**
 * PDF-Optionen eines Lieds aus den GESPEICHERTEN Einstellungen – für Exporte, die kein
 * Einstellungs-Objekt zur Hand haben (Ablauf-PDF in `pages/Setlist.tsx`). So sieht der Export
 * genauso aus wie die Anzeige in der App, inklusive Logo und Tonart im Kopf.
 *
 * Bewusst nur noch die Verbindung zweier vorhandener Teile: Werte lesen (`loadSettings`) und in
 * PDF-Optionen übersetzen (`pdfOptionsForSong`). Vorher stand hier eine **eigene** Fassung von
 * beidem – samt zweiter Kopie von `loadSecShift` und eigenem Zahlen-Parsing. Genau diese Art
 * Dopplung war die Ursache von #239: Drei Stellen rechneten die PDF-Optionen, und eine davon hatte
 * den Kapo-Abzug nicht. Die Rechnung gehört an EINE Stelle.
 */
export function loadSongPdfOpts(
  song: SetlistSong,
  logo?: HTMLImageElement | string | null,
  versionKey: string = selectedVersionKey(song),
): ChordPdfOptions {
  return pdfOptionsForSong(song, loadSettings(song, versionKey), logo ?? null);
}

// Logo wird zentral aus dem eingebetteten Asset geladen (offline-sicher, siehe utils/logoAsset).
export { loadAppLogo } from './logoAsset';
