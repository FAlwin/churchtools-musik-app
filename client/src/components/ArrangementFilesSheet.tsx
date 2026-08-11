/**
 * „Dateien" – die Dateien eines Arrangements sehen und herunterladen (#321, Schritt 3).
 *
 * **Die Liste ist flach und zeigt alles** (Entscheidung Alwin, 11.08.2026): das Original-ChordPro,
 * die von der App verwalteten Versionen, PDFs und Bilder – und alles Übrige, das die App bisher
 * nirgends anzeigte (`.docx`, `.mp3`). Die Art bestimmt nur das Symbol, sie sortiert und schützt
 * nichts.
 *
 * Hochladen und Löschen kommen in Schritt 4; deshalb steht hier noch kein Knopf dafür.
 */
import type { ArrangementFileEntry, ArrangementFileKind } from '@shared/types/index';
import { dateiGroesse } from '../utils/dateiGroesse';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import styles from '../pages/ChordChart.module.scss';

interface ArrangementFilesSheetProps {
  /** Name des Arrangements – steht im Titel, damit klar ist, WESSEN Dateien man sieht. */
  arrangementName: string | null;
  files: ArrangementFileEntry[];
  laedt: boolean;
  /**
   * Der Abruf ist **angehalten**, weil der Server nicht erreichbar ist.
   *
   * Beim Durchklicken aufgefallen (11.08.2026, gemessen): Schlägt der Abruf fehl und gilt die App als
   * offline, hält React Query den nächsten Versuch an – der Zustand bleibt „lädt", ohne dass je ein
   * Fehler entsteht. Ohne diesen Fall stand hier **endlos** „Dateien werden geladen …": eine Anzeige,
   * die etwas verspricht, das gerade gar nicht passiert.
   */
  angehalten: boolean;
  /** Fehlermeldung, falls die Liste nicht geladen werden konnte. */
  fehler: string | null;
  onDownload: (file: ArrangementFileEntry) => void;
  onClose: () => void;
}

/**
 * Das Symbol je Art. Bewusst dieselben Zeichen wie im Lied-Menü bei den Dokumenten (📄 / 🖼️) –
 * eine Datei soll in beiden Listen gleich aussehen.
 */
const SYMBOL: Record<ArrangementFileKind, string> = {
  'chordpro-original': '🎵',
  'chordpro-version': '🎵',
  pdf: '📄',
  image: '🖼️',
  other: '📎',
};

/** Was eine Datei IST – der Zusatz unter dem Namen, damit die vier Klassen unterscheidbar sind. */
const ART: Record<ArrangementFileKind, string> = {
  'chordpro-original': 'ChordPro – daraus entsteht das Notenblatt',
  'chordpro-version': 'ChordPro – von der App verwaltete Version',
  pdf: 'PDF',
  image: 'Bild',
  other: 'Datei',
};

export function ArrangementFilesSheet({
  arrangementName,
  files,
  laedt,
  angehalten,
  fehler,
  onDownload,
  onClose,
}: ArrangementFilesSheetProps) {
  return (
    <Sheet
      title={arrangementName ? `Dateien – ${arrangementName}` : 'Dateien'}
      onClose={onClose}
      cancelLabel="Schließen"
    >
      {laedt && !angehalten && <p className={styles.pickHint}>Dateien werden geladen …</p>}

      {/* „Angehalten" zuerst: Es ist der genauere Satz. „Wird geladen" wäre nicht falsch, aber es
          verspricht etwas, das gerade nicht läuft – und hörte nie auf. */}
      {angehalten && (
        <p className={styles.pickHint}>
          Keine Verbindung zum Server. Die Dateien erscheinen, sobald er wieder erreichbar ist.
        </p>
      )}

      {/* Ein Fehlschlag wird benannt, statt als leere Liste zu erscheinen: „keine Dateien" und
          „konnte nicht laden" sind für den Nutzer zwei völlig verschiedene Aussagen (#270). */}
      {!laedt && !angehalten && fehler && <p className={styles.pickHint}>{fehler}</p>}

      {!laedt && !angehalten && !fehler && files.length === 0 && (
        <p className={styles.pickHint}>In diesem Arrangement liegen keine Dateien.</p>
      )}

      {!laedt &&
        !angehalten &&
        !fehler &&
        files.map((f) => (
          <button key={f.fileId} className={styles.pickRow} onClick={() => onDownload(f)}>
            <span aria-hidden="true">{SYMBOL[f.kind]}</span>
            <span className={styles.pickLevel}>
              <span className={styles.pickName}>{f.name}</span>
              <span className={styles.pickSub}>
                {ART[f.kind]} · {dateiGroesse(f.size)}
              </span>
            </span>
            <Icon name="download" size={16} stroke={2} className={styles.pickChev} />
          </button>
        ))}
    </Sheet>
  );
}
