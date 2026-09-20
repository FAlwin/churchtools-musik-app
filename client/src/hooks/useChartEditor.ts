import { useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { createVersion, updateVersion, deleteVersion } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';
import { getSemitoneOffset, mitTonart, transposeChordpro } from '../utils/transpose';

interface UseChartEditorArgs {
  /** Aktuell angezeigtes Lied. */
  song: SetlistSong;
  /** Schlüssel der aktuell gewählten Version. */
  versionKey: string;
  /** Ist die Originalversion gewählt? (Bearbeiten legt dann eine neue Version an.) */
  isOriginal: boolean;
  /** Anzeigename der aktuellen Version (für Lösch-Dialog). */
  currentVersionName: string;
  /** Aktuell angezeigter ChordPro-Text (Start-Text des Editors). */
  displayedChordpro: string;
  /** Vorlage für ein leeres Lied (wenn noch kein Text existiert). */
  editorTemplate: string;
  /**
   * Die Tonart, in der `displayedChordpro` notiert ist, und die **klingende** Tonart des Blatts
   * (#398). Der Editor öffnet in der klingenden – so, wie das Blatt gerade gelesen wird – und der
   * Text bekommt eine `{key: …}`-Zeile, damit die gespeicherte Version ihre Tonart selbst nennt.
   */
  notierteTonart: string;
  curKey: string;
  onReload?: () => void;
  /** Wählt nach dem Speichern/Löschen die passende Version aus. */
  selectVersion: (songId: number, versionKey: string) => void;
  /**
   * Übernimmt die auf dem Blatt gewählte Tonart in die Einstellungen der **neu angelegten** Version
   * (#398). Ohne das zeigte die neue Version die ChurchTools-Zieltonart – der Nutzer hätte gerade
   * in D geschrieben und sähe danach G.
   */
  uebernimmTonart?: (songId: number, key: string) => void;
}

/**
 * Editor-Zustand für ChordPro-Versionen: Anlegen einer neuen Version, Bearbeiten und Löschen einer
 * bestehenden – inklusive Speicher-Status, Fehlertext und Lösch-Bestätigung. Die ChurchTools-Aufrufe
 * laufen hier gebündelt, getrennt von der reinen Anzeige in `ChordChart`.
 */
export function useChartEditor({
  song,
  versionKey,
  isOriginal,
  currentVersionName,
  displayedChordpro,
  editorTemplate,
  notierteTonart,
  curKey,
  onReload,
  selectVersion,
  uebernimmTonart,
}: UseChartEditorArgs) {
  const [showEditor, setShowEditor] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  // Editor-Modus: neue Version anlegen oder vorhandene bearbeiten (mit Start-Text/-Name).
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; text: string; name: string }>({
    mode: 'new',
    text: '',
    name: '',
  });
  const [confirmDelEdited, setConfirmDelEdited] = useState(false);

  /**
   * Der Start-Text des Editors: **in der klingenden Tonart des Blatts** (#398).
   *
   * Der Text wird von seiner notierten Tonart zur gewählten verschoben und bekommt eine
   * `{key: …}`-Zeile. Bei 0 Halbtönen bleibt er buchstäblich unverändert – kein Umschreiben von
   * Schreibweisen bei jemandem, der nur eine Zeile ändern will.
   *
   * Der Kapo fließt NICHT ein: Er ist eine Griff-Hilfe der Anzeige, der Text steht in der Tonart,
   * die im Kopf des Blatts steht (Entscheidung Alwin, 20.09.2026).
   */
  function startText(): string {
    const quelle = displayedChordpro || editorTemplate;
    const semitones = getSemitoneOffset(notierteTonart, curKey);
    return mitTonart(transposeChordpro(quelle, semitones), curKey);
  }

  /** Öffnet den Editor für die aktuelle Version (Original → neue Version anlegen). */
  function openEditCurrent() {
    setEditorError(null);
    if (isOriginal) {
      setEditor({ mode: 'new', text: startText(), name: '' });
    } else {
      setEditor({ mode: 'edit', text: startText(), name: currentVersionName });
    }
    setShowEditor(true);
  }

  /** Öffnet den Editor zum Anlegen einer NEUEN Version (Start-Text = aktuelle Anzeige). */
  function openNewVersion() {
    setEditorError(null);
    setEditor({ mode: 'new', text: startText(), name: '' });
    setShowEditor(true);
  }

  async function handleEditorSave(text: string, name: string) {
    setEditorSaving(true);
    setEditorError(null);
    try {
      const v =
        editor.mode === 'edit' && !isOriginal
          ? await updateVersion(song.id, song.arrangementId, versionKey, { text, name })
          : await createVersion(song.id, song.arrangementId, name, text);
      setShowEditor(false);
      selectVersion(song.id, v.key);
      // Eine NEUE Version, geschrieben in der gewählten Tonart: Die Wahl geht mit, sonst zeigte die
      // frische Version die Zieltonart aus ChurchTools – und damit nicht das, was eben getippt wurde.
      if (editor.mode === 'new' && curKey !== song.targetKey) uebernimmTonart?.(song.id, curKey);
      onReload?.();
    } catch (e) {
      setEditorError(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setEditorSaving(false);
    }
  }

  async function handleDeleteVersion() {
    setEditorSaving(true);
    setEditorError(null);
    try {
      await deleteVersion(song.id, song.arrangementId, versionKey);
      setShowEditor(false);
      setConfirmDelEdited(false);
      selectVersion(song.id, 'original');
      onReload?.();
    } catch (e) {
      setEditorError(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen.');
    } finally {
      setEditorSaving(false);
    }
  }

  return {
    showEditor,
    setShowEditor,
    editorSaving,
    editorError,
    editor,
    confirmDelEdited,
    setConfirmDelEdited,
    openEditCurrent,
    openNewVersion,
    handleEditorSave,
    handleDeleteVersion,
  };
}
