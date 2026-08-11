/**
 * „Dateien" – die Dateien eines Arrangements sehen, herunterladen, hinzufügen und löschen (#321).
 *
 * **Die Liste ist flach und zeigt alles** (Entscheidung Alwin, 11.08.2026): das Original-ChordPro,
 * die von der App verwalteten Versionen, PDFs und Bilder – und alles Übrige, das die App bisher
 * nirgends anzeigte (`.docx`, `.mp3`). Die Art bestimmt nur das Symbol und den Zusatz; sie sortiert
 * nichts und schützt nichts.
 *
 * **Zwei Knöpfe je Zeile, und das ist Absicht:** Die Zeile selbst lädt herunter, der Papierkorb
 * rechts löscht. Ein Löschen als Wischgeste wäre auf einem Notenpult im Gottesdienst zu leicht
 * ausgelöst – dort wischt man zum Umblättern.
 *
 * Die Texte je Art und die Prüfung vor dem Hochladen liegen in `utils/dateiVerwaltung`: Sie sind rein
 * und damit prüfbar, und der Wortlaut der Rückfrage ist bei einer flachen Liste die einzige Bremse.
 */
import { useRef } from 'react';
import type { ArrangementFileEntry } from '@shared/types/index';
import { DATEI_SYMBOL, dateiZeilen } from '../utils/dateiVerwaltung';
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
  /** Läuft gerade ein Upload? Dann ist der Knopf beschäftigt statt anklickbar. */
  laedtHoch: boolean;
  /**
   * Aus CCLI SongSelect holen anbieten? (#322)
   *
   * `null`, wenn nicht: keine SongSelect-Lizenz der Gemeinde, oder das Lied hat keine CCLI-Nummer.
   * Ein Knopf, der ohne beides immer scheitert, ist schlimmer als keiner.
   */
  songSelect: { songNumber: number; laeuft: boolean } | null;
  onDownload: (file: ArrangementFileEntry) => void;
  onUpload: (datei: File) => void;
  onDelete: (file: ArrangementFileEntry) => void;
  onSongSelect: () => void;
  onClose: () => void;
}

export function ArrangementFilesSheet({
  arrangementName,
  files,
  laedt,
  angehalten,
  fehler,
  laedtHoch,
  songSelect,
  onDownload,
  onUpload,
  onDelete,
  onSongSelect,
  onClose,
}: ArrangementFilesSheetProps) {
  const dateiFeld = useRef<HTMLInputElement>(null);
  /** Die Liste ist erst dann echt, wenn nichts dazwischenkommt – sonst hätte „hinzufügen" kein Ziel. */
  const listeDa = !laedt && !angehalten && !fehler;

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

      {listeDa && files.length === 0 && (
        <p className={styles.pickHint}>In diesem Arrangement liegen keine Dateien.</p>
      )}

      {listeDa &&
        files.map((f) => (
          <div key={f.fileId} className={styles.fileRow}>
            <button
              className={styles.pickRow}
              onClick={() => onDownload(f)}
              title="Auf das Gerät laden"
            >
              <span aria-hidden="true">{DATEI_SYMBOL[f.kind]}</span>
              <span className={styles.pickLevel}>
                <span className={styles.pickName}>{dateiZeilen(f).titel}</span>
                <span className={styles.pickSub}>{dateiZeilen(f).unter}</span>
              </span>
              <Icon name="download" size={16} stroke={2} className={styles.pickChev} />
            </button>
            <button
              className={styles.fileDel}
              onClick={() => onDelete(f)}
              title={`„${f.name}" löschen`}
              aria-label={`„${f.name}" löschen`}
            >
              <Icon name="trash" size={16} stroke={2} />
            </button>
          </div>
        ))}

      {/* Hinzufügen nur, wenn die Liste wirklich vorliegt: Ohne sie wüsste die Prüfung nicht, ob es
          den Namen schon gibt – und würde stillschweigend ein Doppel anlegen. */}
      {listeDa && (
        <>
          <input
            ref={dateiFeld}
            type="file"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0];
              // Das Feld wird geleert, damit dieselbe Datei ein zweites Mal ausgewählt werden kann –
              // ohne das feuert `change` beim gleichen Namen nicht erneut.
              e.target.value = '';
              if (datei) onUpload(datei);
            }}
          />
          <button
            className={styles.importBtn}
            onClick={() => dateiFeld.current?.click()}
            disabled={laedtHoch}
          >
            {laedtHoch ? 'Wird hochgeladen …' : 'Datei hinzufügen …'}
          </button>
          {/* Aus SongSelect holen – nur mit Lizenz UND CCLI-Nummer (#322). Steht unter dem
              Hochladen, weil es der seltenere Weg ist: Man holt einmal und lädt danach eigene
              Dateien dazu. */}
          {songSelect && (
            <button
              className={styles.importBtn}
              onClick={onSongSelect}
              disabled={songSelect.laeuft}
            >
              {songSelect.laeuft ? 'Wird geholt …' : 'Notenblatt aus SongSelect holen …'}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
