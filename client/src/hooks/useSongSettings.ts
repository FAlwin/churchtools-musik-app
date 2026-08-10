import { useCallback, useEffect, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { loadSettings, DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';
import { setLsVersion, setLsSong } from '../utils/songVersions';
import { useLatestRef } from './useLatestRef';

/**
 * Anzeige-Einstellungen aller Lieder eines Ablaufs: halten, ändern, dauerhaft speichern (#198).
 *
 * Lag vorher in `ChordChart` und verletzte damit die eigene Konvention „keine Geschäftslogik in
 * Komponenten": Der Screen kannte localStorage-Schlüsselnamen und entschied, welche Änderung wie
 * gespeichert wird. Beides gehört hierher – die Schlüssel selbst bildet ausschließlich
 * `utils/songVersions.ts`.
 *
 * **Die Regel, die man leicht übersieht:** Fast alles gilt **pro Version** (Tonart, Kapo, Spalten,
 * Schrift, „Nur Text", Abschnitts-Transponierung) – wer eine Akustik-Fassung anders eingestellt
 * hat, soll das behalten. Zwei Dinge gelten dagegen **pro Lied**: die gewählte Version selbst und
 * die Anzeigequelle (Akkorde oder hochgeladenes Dokument – die hängt am Arrangement, nicht an der
 * ChordPro-Fassung).
 */
export function useSongSettings(songs: SetlistSong[]) {
  const [settings, setSettings] = useState<Record<number, SongSettings>>(() =>
    Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])),
  );
  // Die Lied-Liste wird bei jedem Render neu erzeugt; für die Effekte zählt nur, WELCHE Lieder es
  // sind – deshalb die ID-Signatur als Abhängigkeit und die Liste selbst aus einer Ref.
  const songIds = songs.map((s) => s.id).join(',');
  const songsRef = useLatestRef(songs);

  /** Alles aus dem lokalen Speicher neu übernehmen (nach Lied-Wechsel oder Konto-Sync). */
  const reload = useCallback(() => {
    setSettings(Object.fromEntries(songsRef.current.map((s) => [s.id, loadSettings(s)])));
  }, [songsRef]);

  useEffect(reload, [songIds, reload]);

  /** Einzelne Einstellungen ändern und genau die geänderten dauerhaft schreiben. */
  const updateSetting = useCallback((songId: number, patch: Partial<SongSettings>) => {
    setSettings((prev) => {
      const cur = prev[songId] ?? DEFAULT_SETTINGS;
      const next = { ...cur, ...patch };
      const vk = next.versionKey;
      if ('key' in patch) setLsVersion('key', songId, vk, next.key);
      if ('capo' in patch) setLsVersion('capo', songId, vk, String(next.capo));
      if ('cols' in patch) setLsVersion('cols', songId, vk, String(next.cols));
      if ('fontSize' in patch) setLsVersion('fs', songId, vk, String(next.fontSize));
      if ('lyricsOnly' in patch) setLsVersion('lyrics', songId, vk, next.lyricsOnly ? '1' : '0');
      if ('zaehlweise' in patch)
        setLsVersion(
          'zaehl',
          songId,
          vk,
          next.zaehlweise === null ? null : String(next.zaehlweise),
        );
      if ('viewSource' in patch) setLsSong('view', songId, String(next.viewSource));
      // Pro LIED, nicht je Version: Die Versionen liegen im Arrangement (siehe `SongSettings`).
      if ('arrangementId' in patch)
        setLsSong('arr', songId, next.arrangementId === null ? null : String(next.arrangementId));
      if ('secShift' in patch) {
        const has = Object.keys(next.secShift).length > 0;
        setLsVersion('secshift', songId, vk, has ? JSON.stringify(next.secShift) : null);
      }
      return { ...prev, [songId]: next };
    });
  }, []);

  /** Wechselt die gewählte Version eines Lieds und lädt deren Einstellungen. */
  const selectVersion = useCallback(
    (songId: number, versionKey: string) => {
      setLsSong('ver', songId, versionKey);
      const s = songsRef.current.find((x) => x.id === songId);
      setSettings((prev) => ({
        ...prev,
        [songId]: s ? loadSettings(s, versionKey) : prev[songId],
      }));
    },
    [songsRef],
  );

  return { settings, updateSetting, selectVersion, reloadSettings: reload };
}
