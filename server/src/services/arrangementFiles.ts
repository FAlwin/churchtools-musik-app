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
import type { ArrangementFileEntry, ArrangementFileKind, SongDocument } from '@shared/types/index';
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

/**
 * Dateiname einer verwalteten Version aus Lied-Titel + Versionsname.
 *
 * Der Versionsname verliert zusätzlich die Klammern: Sie sind für das `(App)`-Kürzel reserviert, das
 * eine verwaltete Version erkennbar macht (siehe `versionNameOf`).
 */
export function versionFileName(songName: string, versionName: string): string {
  const safeTitle = safeFileName(songName);
  const safeName = safeFileName(versionName).replace(/[()]/g, '').trim();
  return `${safeTitle} — ${safeName} ${VERSION_TAG}.chordpro`;
}

/**
 * Woran ein Dokument erkannt wird – **einmal**, für die Dokumentenanzeige UND die Dateiverwaltung.
 *
 * Vorher standen die beiden Muster inline in `documentsOf`. Mit `fileKind` (#321) hätte es sie ein
 * zweites Mal gebraucht: dieselbe Frage, zwei Antworten, die auseinanderlaufen können – etwa wenn
 * eines Tages `.heic` dazukommt.
 */
const PDF_RE = /\.pdf$/i;
const BILD_RE = /\.(jpe?g|png|gif|webp)$/i;

/** PDF/Bild-Dokumente eines Arrangements (für die Dokumentenanzeige). */
export function documentsOf(files: CtArrangementFile[]): SongDocument[] {
  const out: SongDocument[] = [];
  for (const f of files) {
    const fileId = fileIdFromUrl(f.fileUrl);
    if (fileId === null) continue;
    if (PDF_RE.test(f.name)) out.push({ fileId, name: f.name, type: 'pdf' });
    else if (BILD_RE.test(f.name)) out.push({ fileId, name: f.name, type: 'image' });
  }
  return out;
}

/**
 * Die Art EINER Datei (#321) – über dieselben Erkennungen wie oben, keine eigenen.
 *
 * Die Reihenfolge zählt: Eine verwaltete Version ist auch eine `.chordpro`-Datei, also muss sie
 * zuerst gefragt werden. `isOriginalChordpro` schließt Versionen selbst aus – die Reihenfolge ist
 * damit doppelt abgesichert und nicht bloß Glück.
 */
export function fileKind(f: CtArrangementFile): ArrangementFileKind {
  if (isVersionFile(f)) return 'chordpro-version';
  if (isOriginalChordpro(f)) return 'chordpro-original';
  if (PDF_RE.test(f.name)) return 'pdf';
  if (BILD_RE.test(f.name)) return 'image';
  return 'other';
}

/** Größe in Bytes – ChurchTools liefert sie als Zahl ODER als Text (wie `bpm`), oder gar nicht. */
function groesseVon(f: CtArrangementFile): number | null {
  const n = typeof f.size === 'string' ? Number(f.size) : f.size;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * ALLE Dateien eines Arrangements für die Dateiverwaltung (#321) – flach, nichts weggelassen.
 *
 * Anders als `documentsOf`: Dort sind nur die anzeigbaren Dokumente gemeint, hier ist die ganze
 * Liste gefragt, inklusive ChordPro und allem, was die App bisher gar nicht zeigt (`.docx`, `.mp3`).
 *
 * **Ohne Datei-ID kein Eintrag.** Die ID kommt aus der `fileUrl`; ohne sie ließe sich die Datei
 * weder herunterladen noch löschen. Ein Eintrag, dessen Knöpfe beide ins Leere führen, wäre
 * schlimmer als keiner.
 */
export function arrangementFileEntries(files: CtArrangementFile[]): ArrangementFileEntry[] {
  const out: ArrangementFileEntry[] = [];
  for (const f of files) {
    const fileId = fileIdFromUrl(f.fileUrl);
    if (fileId === null) continue;
    out.push({ fileId, name: f.name, size: groesseVon(f), kind: fileKind(f) });
  }
  return out;
}

/**
 * Entfernt aus einem Dateinamen die Zeichen, die in Dateisystemen und URLs Ärger machen.
 *
 * Stand vorher inline in `versionFileName`. Mit dem Hochladen beliebiger Dateien (#321) braucht es
 * dieselbe Reinigung ein zweites Mal – also hier, statt sie abzuschreiben. Der Pfadtrenner ist
 * dabei der wichtigste: Ein Name wie `../../geheim` darf nicht entstehen.
 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').trim();
}
