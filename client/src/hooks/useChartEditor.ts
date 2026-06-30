import { useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { createVersion, updateVersion, deleteVersion } from '../services/churchtoolsApi';
import { ApiError } from '../services/api';

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
  onReload?: () => void;
  /** Wählt nach dem Speichern/Löschen die passende Version aus. */
  selectVersion: (songId: number, versionKey: string) => void;
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
  onReload,
  selectVersion,
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

  /** Öffnet den Editor für die aktuelle Version (Original → neue Version anlegen). */
  function openEditCurrent() {
    setEditorError(null);
    if (isOriginal) {
      setEditor({ mode: 'new', text: displayedChordpro || editorTemplate, name: '' });
    } else {
      setEditor({ mode: 'edit', text: displayedChordpro, name: currentVersionName });
    }
    setShowEditor(true);
  }

  /** Öffnet den Editor zum Anlegen einer NEUEN Version (Start-Text = aktuelle Anzeige). */
  function openNewVersion() {
    setEditorError(null);
    setEditor({ mode: 'new', text: displayedChordpro || editorTemplate, name: '' });
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
