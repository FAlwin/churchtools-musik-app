/**
 * Die Dateien EINES Arrangements: Welche davon sind von der App verwaltete ChordPro-Versionen,
 * wie heißen sie, und welche sind Dokumente (PDF/Bild) für die Anzeige? (#198)
 *
 * Zusammen in einer Datei, weil alle vier Funktionen dieselbe Dateiliste klassifizieren – die
 * Erkennung einer Version und die Erkennung eines Dokuments sind zwei Seiten derselben Frage.
 * (Das Issue schlug `versionNaming.ts` vor; `documentsOf` davon zu trennen hätte zwei Funktionen
 * auseinandergerissen, die immer gemeinsam gelesen werden.)
 *
 * Alles rein und ohne Netzzugriff – deshalb direkt testbar.
 */
import type { SongDocument } from '@shared/types/index';
import { fileIdFromUrl } from './ctFiles.js';
import type { CtArrangementFile } from './ctTypes.js';

const VERSION_TAG = '(App)';

/** Macht aus einem Versionsnamen einen stabilen Schlüssel (Slug). */
export function versionSlug(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Akzente entfernen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'version';
}

/**
 * Erkennt am Namen, ob eine Datei eine von uns verwaltete Version ist, und liefert deren Namen.
 *
 * Das `(App)`-Kürzel erkennt unsere Dateien zuverlässig – ein Originalname, der zufällig einen
 * Bindestrich enthält, wird nicht verwechselt – und ist, anders als das frühere `(ECG)`, nicht
 * gemeindespezifisch.
 *
 * Aktueller Marker „— <Name> (App).chordpro"; abwärtskompatibel:
 *  - „— <Name> (ECG).chordpro" (Bestandsdateien mit dem früheren, gemeindespezifischen Kürzel)
 *  - „— Bearbeitet.chordpro" / „— ECG.chordpro" (ganz alte namenlose Varianten → Name „Bearbeitet").
 */
export function versionNameOf(f: CtArrangementFile): string | null {
  const tagged = f.name.match(/[—-]\s*(.+?)\s*\((?:App|ECG)\)\.chordpro$/i);
  if (tagged) return tagged[1].trim();
  if (/[—-]\s*(?:bearbeitet|ecg)\.chordpro$/i.test(f.name)) return 'Bearbeitet';
  return null;
}
export function isVersionFile(f: CtArrangementFile): boolean {
  return versionNameOf(f) !== null;
}
export function isOriginalChordpro(f: CtArrangementFile): boolean {
  return /\.chordpro$/i.test(f.name) && !isVersionFile(f);
}

/** Dateiname einer verwalteten Version aus Lied-Titel + Versionsname. */
export function versionFileName(songName: string, versionName: string): string {
  const safeTitle = songName.replace(/[\\/:*?"<>|]/g, '').trim();
  const safeName = versionName.replace(/[\\/:*?"<>|()]/g, '').trim();
  return `${safeTitle} — ${safeName} ${VERSION_TAG}.chordpro`;
}

/** PDF/Bild-Dokumente eines Arrangements (für die Dokumentenanzeige). */
export function documentsOf(files: CtArrangementFile[]): SongDocument[] {
  const out: SongDocument[] = [];
  for (const f of files) {
    const fileId = fileIdFromUrl(f.fileUrl);
    if (fileId === null) continue;
    if (/\.pdf$/i.test(f.name)) out.push({ fileId, name: f.name, type: 'pdf' });
    else if (/\.(jpe?g|png|gif|webp)$/i.test(f.name))
      out.push({ fileId, name: f.name, type: 'image' });
  }
  return out;
}
