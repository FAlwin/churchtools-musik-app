/**
 * „Stammdaten ändern" – Name, Kategorie, Autor, CCLI-Nummer und Copyright eines vorhandenen Liedes
 * (#322, Schritt 11). Und, mit deutlicher Rückfrage, das **Löschen**.
 *
 * **Es werden nur die geänderten Felder geschickt** (`aenderungAus`). Der Server baut daraus einen
 * vollständigen `PUT`, weil ChurchTools bei einem Teil-`PUT` die nicht gesendeten Felder löscht –
 * gemessen an der Test-Instanz: Ein `PUT {name, categoryId}` räumte Autor, CCLI-Nummer und Copyright ab.
 * Die Oberfläche muss davon nichts wissen, aber sie darf sich auch nicht darauf verlassen, dass ein
 * fehlendes Feld „unverändert" heißt – deshalb steht die Umrechnung in einer geprüften Funktion.
 *
 * **Die Felder selbst kommen aus `SongFields`** – dieselbe Komponente wie beim Anlegen. Tonart und
 * Arrangement-Name fehlen hier mit Absicht: Sie gehören zum Arrangement, nicht zum Lied.
 *
 * **Die Rückfrage vor dem Löschen nennt die Folgen**, statt „wirklich?" zu fragen: Mit dem Lied gehen
 * seine Arrangements, Notenblätter und Dateien. Das ist Alwins Entscheidung vom 13.08.2026 – löschen
 * ja, aber nicht beiläufig.
 */
import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import { CenterMessage } from './CenterMessage';
import { ConfirmDialog } from './ConfirmDialog';
import { SongFields } from './SongFields';
import { ChordEditor } from './ChordEditor';
import { useNotenblatt } from '../hooks/useNotenblatt';
// Die Feld-Stile direkt aus dem Modul: Ein Re-Export über die Komponente bricht Fast Refresh.
import feld from './SongFields.module.scss';
import {
  useLiedAendern,
  useLiedLoeschen,
  useSongCategories,
  useSongLibrary,
  useSongStammdaten,
} from '../hooks/useServices';
import {
  LEERES_FORMULAR,
  aenderungAus,
  formularAusLied,
  formularBereit,
  hatAenderung,
  namensWarnung,
  type NeuesLiedFormular,
} from '../utils/liedFormular';
import styles from './NewSongSheet.module.scss';

interface EditSongSheetProps {
  songId: number;
  /**
   * Das Arrangement, dessen **Original-Notenblatt** der Editor schreibt (Wunsch Alwin, 04.09.2026:
   * „im Bearbeitungsmodus auch direkt in den Editor kommen"). Aus dem Liederheft das Standard-Arrangement,
   * aus dem Blatt das gerade angezeigte.
   */
  arrangementId: number;
  /** Tonart für das Gerüst, falls es noch kein Blatt gibt – die Stammdaten kennen sie nicht. */
  tonart?: string | null;
  /** Der bekannte Name – steht im Titel, bis die Stammdaten geladen sind. */
  songName?: string;
  /**
   * Wird nach dem **Löschen** aufgerufen – mit der **fertigen Meldung**.
   *
   * Der Wortlaut steht hier und nicht bei den Aufrufern: Es gibt zwei (Liederheft und Chart), und
   * zwei Stellen mit demselben Satz wären zwei Stellen, an denen eine Korrektur landen müsste.
   * Der Aufrufer entscheidet nur, was er sonst noch tut – im Chart etwa die Ansicht verlassen, denn
   * ein Blatt zu einem gelöschten Lied wäre eine Sackgasse.
   */
  onDeleted?: (meldung: string) => void;
  /** Wird nach erfolgreichem Speichern aufgerufen – ebenfalls mit der fertigen Meldung. */
  onSaved?: (meldung: string) => void;
  onClose: () => void;
}

export function EditSongSheet({
  songId,
  arrangementId,
  tonart,
  songName,
  onDeleted,
  onSaved,
  onClose,
}: EditSongSheetProps) {
  const stammdaten = useSongStammdaten(songId);
  const kategorien = useSongCategories(true);
  // Nur für die Warnung bei gleichem Namen – die Liste ist ohnehin geladen.
  const bibliothek = useSongLibrary(true);
  const aendern = useLiedAendern(songId);
  const loeschen = useLiedLoeschen();

  const [formular, setFormular] = useState<NeuesLiedFormular>(LEERES_FORMULAR);
  const [geladenFuer, setGeladenFuer] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);

  /**
   * **Notenblatt bearbeiten** – derselbe Weg wie nach dem Anlegen (`useNotenblatt`). Ob es schon ein
   * Blatt gibt, weiß dieses Blatt nicht; der Hook sieht nach und liefert sonst das Gerüst.
   */
  const notenblatt = useNotenblatt({ songId, arrangementId });
  const [editor, setEditor] = useState<{ text: string } | null>(null);
  const [editorLaedt, setEditorLaedt] = useState(false);

  const ist = stammdaten.data ?? null;

  const editorOeffnen = async (): Promise<void> => {
    setEditorLaedt(true);
    try {
      const text = await notenblatt.text(
        {
          title: formular.name.trim() || ist?.name || songName || '',
          key: tonart,
          ccli: formular.ccli,
        },
        null,
      );
      setEditor({ text });
    } finally {
      setEditorLaedt(false);
    }
  };

  /**
   * Das Formular **einmal** aus den geladenen Daten füllen – nicht bei jedem Render.
   *
   * `geladenFuer` merkt, für welches Lied das schon passiert ist. Ohne diese Sperre würde ein
   * Hintergrund-Abgleich (oder das `setQueryData` nach dem Speichern) die Eingaben des Nutzers
   * mitten im Tippen überschreiben.
   */
  useEffect(() => {
    if (ist && geladenFuer !== ist.songId) {
      setFormular(formularAusLied(ist));
      setGeladenFuer(ist.songId);
    }
  }, [ist, geladenFuer]);

  const kategorieListe = kategorien.data ?? [];
  const warnung = namensWarnung(formular.name, bibliothek.data ?? [], songId);
  const bereit =
    ist !== null && formularBereit(formular) && hatAenderung(formular, ist) && !aendern.isPending;

  async function speichern(): Promise<void> {
    if (!ist) return;
    setFehler(null);
    try {
      const stand = await aendern.mutateAsync(aenderungAus(formular, ist));
      // Mit dem Stand vom Server weiterarbeiten, nicht mit dem Formular: Was ChurchTools daraus
      // gemacht hat, ist die Wahrheit (etwa ein getrimmter Name).
      setFormular(formularAusLied(stand));
      onSaved?.(`„${stand.name}" wurde gespeichert.`);
      onClose();
    } catch (e) {
      // Der Grund kommt vom Server (Recht, doppelte CCLI-Nummer, Netz) – das Blatt bleibt offen,
      // damit die Eingaben nicht verloren gehen (#270).
      setFehler(e instanceof Error ? e.message : 'Das Speichern ist fehlgeschlagen.');
    }
  }

  async function loeschenBestaetigen(): Promise<void> {
    setLoeschFrage(false);
    setFehler(null);
    try {
      const { name } = await loeschen.mutateAsync(songId);
      onDeleted?.(`„${name}" wurde gelöscht.`);
      onClose();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das Löschen ist fehlgeschlagen.');
    }
  }

  return (
    <>
      {/* „Schließen", nicht „Abbrechen": Es gibt nichts abzubrechen – Gespeichertes ist gespeichert.
          Und über dem Blatt kann die Lösch-Rückfrage liegen, die selbst ein „Abbrechen" hat; zwei
          gleich beschriftete Knöpfe übereinander wären eine Frage zu viel. */}
      <Sheet
        title={ist?.name ?? songName ?? 'Lied ändern'}
        onClose={onClose}
        cancelLabel="Schließen"
      >
        {fehler && <div className={styles.err}>{fehler}</div>}

        {stammdaten.isError ? (
          <CenterMessage
            icon="⚠️"
            text="Die Stammdaten konnten nicht geladen werden."
            onRetry={() => void stammdaten.refetch()}
          />
        ) : !ist ? (
          <CenterMessage loading text="Stammdaten werden geladen…" />
        ) : ist.categoryId === null ? (
          /* Ohne Kategorie nimmt ChurchTools kein `PUT` an (Pflichtfeld, gemessen). Dann ist ein
             ehrlicher Satz besser als ein Formular, dessen Speichern sicher scheitert. */
          <div className={styles.hint}>
            Dieses Lied hat in ChurchTools keine Kategorie. Ohne sie lässt es sich hier nicht ändern
            – bitte die Kategorie zuerst in ChurchTools setzen.
          </div>
        ) : (
          <div className={feld.form}>
            <SongFields
              formular={formular}
              onFeld={(f, wert) => setFormular((alt) => ({ ...alt, [f]: wert }))}
              onKategorie={(id) => setFormular((f) => ({ ...f, categoryId: id }))}
              kategorien={kategorieListe}
              warnung={warnung}
            />

            <button
              className={styles.primaryWide}
              disabled={!bereit}
              onClick={() => void speichern()}
            >
              {aendern.isPending ? 'Wird gespeichert …' : 'Speichern'}
            </button>

            {/* Der Weg zum Text – ohne Umweg über Öffnen → Neue Version (04.09.2026). Schreibt das
                ORIGINAL des Arrangements; die eigenen Fassungen bleiben. */}
            <button
              className={styles.secondaryWide}
              disabled={editorLaedt}
              onClick={() => void editorOeffnen()}
            >
              {editorLaedt ? 'Notenblatt wird geladen …' : 'Notenblatt bearbeiten'}
            </button>

            {/* Löschen steht unten und getrennt: Es ist der seltene, folgenreiche Weg. */}
            <button
              className={styles.dangerWide}
              disabled={loeschen.isPending}
              onClick={() => setLoeschFrage(true)}
            >
              <Icon name="trash" size={16} stroke={2} />
              {loeschen.isPending ? ' Wird gelöscht …' : ' Lied löschen …'}
            </button>
          </div>
        )}
      </Sheet>

      {editor && (
        <ChordEditor
          songTitle={ist?.name ?? songName ?? ''}
          initialText={editor.text}
          initialName=""
          isNew
          mitVersionsname={false}
          saving={notenblatt.laeuft}
          error={notenblatt.fehler}
          onSave={(text) => {
            void notenblatt.speichern(text).then((ok) => {
              if (!ok) return;
              setEditor(null);
              onSaved?.(
                `Das Notenblatt von „${ist?.name ?? songName ?? 'diesem Lied'}" wurde gespeichert.`,
              );
            });
          }}
          onClose={() => setEditor(null)}
        />
      )}

      {loeschFrage && ist && (
        <ConfirmDialog
          title="Lied löschen?"
          /* Die Folgen ausdrücklich – nicht „wirklich?". Wer hier zustimmt, soll wissen, was mitgeht. */
          message={
            `„${ist.name}" wird in ChurchTools gelöscht – mit allen Arrangements, Notenblättern und ` +
            `Dateien. Steht das Lied in einem Ablauf, fehlt es dort danach. Das lässt sich über die ` +
            `App nicht zurückholen.`
          }
          confirmLabel="Löschen"
          onConfirm={() => void loeschenBestaetigen()}
          onCancel={() => setLoeschFrage(false)}
        />
      )}
    </>
  );
}
