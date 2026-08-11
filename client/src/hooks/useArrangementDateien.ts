/**
 * Die Dateiverwaltung eines Arrangements: laden, hochladen, löschen (#321, Schritt 4).
 *
 * **Warum als Hook und nicht inline in `ChordChart`:** Die Reihenfolge „erst melden, dann
 * auffrischen" ist eine Regel, die man testen können muss – siehe unten. Inline in einer Seite mit
 * über 800 Zeilen wäre sie nur durch Anklicken prüfbar, und genau dort ist sie mir schon einmal
 * durchgegangen.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArrangementFileEntry } from '@shared/types/index';
import {
  deleteSongFile,
  getArrangementFiles,
  getSongFileBlob,
  uploadArrangementFile,
} from '../services/churchtoolsApi';
import { shareOrDownload } from '../utils/shareFile';
import { pruefeUpload } from '../utils/dateiVerwaltung';

interface Args {
  songId: number;
  arrangementId: number;
  /** Nur laden, wenn das Blatt offen ist – sonst ein Abruf gegen ChurchTools für nichts (#300). */
  aktiv: boolean;
  showToast: (text: string) => void;
  /** Das Lied neu holen, damit ein neues PDF auch im Menü unter „Anzeige" auftaucht. */
  onReload?: () => void;
}

export function useArrangementDateien({ songId, arrangementId, aktiv, showToast, onReload }: Args) {
  const qc = useQueryClient();
  const [laedtHoch, setLaedtHoch] = useState(false);
  /** Datei, deren Löschung nachgefragt wird – `null` = keine Rückfrage offen. */
  const [loeschDatei, setLoeschDatei] = useState<ArrangementFileEntry | null>(null);
  /** Ausgewählte Datei, deren Doppel-Warnung noch bestätigt werden muss. */
  const [uploadWarnung, setUploadWarnung] = useState<{ datei: File; text: string } | null>(null);

  const dateien = useQuery({
    queryKey: ['arrangement-files', songId, arrangementId],
    queryFn: () => getArrangementFiles(songId, arrangementId),
    enabled: aktiv,
    staleTime: 1000 * 30,
  });

  /**
   * Liste und Lied auffrischen – **ohne `await`, und das ist der Kern dieser Datei.**
   *
   * Gefunden beim Durchklicken (11.08.2026): Stand hier `await qc.invalidateQueries(...)` vor der
   * Erfolgsmeldung, blieb nach einem erfolgreichen Löschen **jede Rückmeldung aus**. Grund ist
   * dieselbe Mechanik wie beim Laden: Gilt der Server als unerreichbar, **hält React Query das
   * Nachladen an** – und das Versprechen von `invalidateQueries` wird dann nie erfüllt. Der `await`
   * hing also für immer, und die Zeile mit der Meldung wurde nie erreicht.
   *
   * Richtig ist die Reihenfolge ohnehin: Gemeldet wird, was **passiert ist** (das Löschen war
   * erfolgreich). Das Auffrischen der Anzeige ist eine Bequemlichkeit danach – es darf die Nachricht
   * über den Erfolg nicht aufhalten und schon gar nicht verschlucken.
   */
  const auffrischen = (): void => {
    void qc.invalidateQueries({ queryKey: ['arrangement-files', songId, arrangementId] });
    onReload?.();
  };

  const herunterladen = async (f: ArrangementFileEntry): Promise<void> => {
    try {
      await shareOrDownload(await getSongFileBlob(songId, f.fileId), f.name);
    } catch {
      showToast('Die Datei konnte nicht geladen werden.');
    }
  };

  const hochladen = async (datei: File): Promise<void> => {
    setLaedtHoch(true);
    try {
      await uploadArrangementFile(songId, arrangementId, datei);
      showToast(`„${datei.name}" wurde hinzugefügt.`);
      auffrischen();
    } catch (e) {
      // Der Grund kommt vom Server (z. B. „Keine Berechtigung …"), nicht als allgemeines „hat nicht
      // geklappt": Nur so weiß man, ob es am Recht, an der Datei oder am Netz lag (#270).
      showToast(e instanceof Error ? e.message : 'Das Hochladen ist fehlgeschlagen.');
    } finally {
      setLaedtHoch(false);
    }
  };

  /** Eine ausgewählte Datei annehmen: prüfen, dann hochladen oder nachfragen. */
  const dateiGewaehlt = (datei: File): void => {
    const befund = pruefeUpload(datei, dateien.data ?? []);
    if (befund?.art === 'fehler') {
      showToast(befund.text);
      return;
    }
    if (befund?.art === 'warnung') {
      setUploadWarnung({ datei, text: befund.text });
      return;
    }
    void hochladen(datei);
  };

  const warnungBestaetigen = (): void => {
    const datei = uploadWarnung?.datei;
    setUploadWarnung(null);
    if (datei) void hochladen(datei);
  };

  const loeschenBestaetigen = async (): Promise<void> => {
    const f = loeschDatei;
    setLoeschDatei(null);
    if (!f) return;
    try {
      await deleteSongFile(songId, f.fileId);
      showToast(`„${f.name}" wurde gelöscht.`);
      auffrischen();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Das Löschen ist fehlgeschlagen.');
    }
  };

  return {
    dateien,
    laedtHoch,
    loeschDatei,
    setLoeschDatei,
    uploadWarnung,
    setUploadWarnung,
    herunterladen,
    dateiGewaehlt,
    warnungBestaetigen,
    loeschenBestaetigen,
  };
}
