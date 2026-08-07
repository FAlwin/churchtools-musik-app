import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { SetlistSong } from '@shared/types/index';
import {
  migrateLocalAnnotations,
  pullAnnotations,
  resumePendingAnnotations,
} from '../services/annotations';
import {
  migrateLocalSettings,
  pullSettings,
  resumePendingSettings,
} from '../services/userSettings';

/**
 * Alles, was die Chart-Ansicht im Hintergrund aktuell hält (#314).
 *
 * Lag als drei Effekte über `ChordChart.tsx` verteilt und war ungetestet, obwohl hier die Regel
 * steht, die im Gottesdienst am meisten wehtut: **Im Zeichenmodus wird nichts aufgefrischt.** Ein
 * Nachladen mitten im Strich würde die Seite neu aufbauen und den Strich verlieren.
 *
 * Drei Takte, die sich bewusst unterscheiden:
 *  - **Anmerkungen alle 30 s** – sie kommen vom eigenen Konto und sollen zwischen den Geräten
 *    zusammenlaufen.
 *  - **Inhalt alle 60 s** (Ablauf/Liedtexte) – ersetzt den früheren „Aktualisieren"-Knopf, damit
 *    Änderungen auch auf einem iPad ankommen, das die ganze Zeit offen im Lied steht.
 *  - **Bei Rückkehr zur App** alles zusammen, entprellt: `focus` und `visibilitychange` feuern
 *    beide, sonst liefe jede Rückkehr doppelt.
 */

/** Takt für die Anmerkungen des eigenen Kontos. */
export const ANNO_REFRESH_MS = 30_000;
/** Takt für Ablauf und Liedtexte. */
export const CONTENT_REFRESH_MS = 60_000;
/** Entprellung: `focus` und `visibilitychange` feuern bei einer Rückkehr beide. */
export const RETURN_DEBOUNCE_MS = 2000;

interface UseChartSyncArgs {
  songs: SetlistSong[];
  /**
   * Signatur über den INHALT aller Versionen. Ändert sie sich, wird komplett neu synchronisiert –
   * nicht nur bei geänderter Lied-Liste, sondern auch nach dem Bearbeiten eines Textes.
   */
  songsSig: string;
  /** Im Zeichenmodus pausiert jedes Auffrischen. */
  drawMode: boolean;
  /** Ablauf/Liedtexte neu vom Server holen (Sache der aufrufenden Seite). */
  onReload?: () => void;
  /** Einstellungen aus dem lokalen Speicher neu übernehmen (useSongSettings). */
  reloadSettings: () => void;
  /**
   * Nach dem Erst-Sync auszuführen – hier: die Liste der Teilenden holen.
   *
   * Bewusst als Rückruf und nicht als direkter Aufruf: `refreshSharers` entsteht erst in
   * `useTeamNotesImport`, das seinerseits `setSyncTick` von hier braucht. Der Aufrufer reicht
   * deshalb eine stabile Hülle herein, die zur Laufzeit auf die dann vorhandene Funktion zeigt.
   */
  onAfterInitialPull?: () => void;
}

export function useChartSync({
  songs,
  songsSig,
  drawMode,
  onReload,
  reloadSettings,
  onAfterInitialPull,
}: UseChartSyncArgs): {
  /** Zählt hoch, wenn die Anzeige sich neu ausrichten soll (PageDeck liest ihn als Signal). */
  syncTick: number;
  setSyncTick: Dispatch<SetStateAction<number>>;
  /** Ein Signal auslösen – stabile Identität, damit Effekte davon nicht neu anlaufen. */
  bumpSync: () => void;
} {
  const [syncTick, setSyncTick] = useState(0);
  const bumpSync = useCallback(() => setSyncTick((t) => t + 1), []);

  // Aktuelle Werte in einer Ref, damit die Effekte unten stabil bleiben und die Intervalle nicht
  // bei jedem Render neu angemeldet werden.
  const live = useRef({ songs, drawMode, onReload, onAfterInitialPull, lastReturn: 0 });
  live.current.songs = songs;
  live.current.drawMode = drawMode;
  live.current.onReload = onReload;
  live.current.onAfterInitialPull = onAfterInitialPull;

  // ── Erst-Sync beim Öffnen (und bei jeder Inhaltsänderung) ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = live.current.songs.map((s) => s.id);
      // Reihenfolge ist wichtig: Erst die beim letzten Mal NICHT durchgegangenen Uploads nachholen
      // (#256 Anmerkungen, #275 Einstellungen) und bestehende lokale Daten einmalig hochladen – DANN
      // den Server-Stand holen. Andernfalls überschreibt der Pull genau das, was noch hochzuladen ist.
      await Promise.all([resumePendingAnnotations(), resumePendingSettings()]);
      await Promise.all([migrateLocalAnnotations(), migrateLocalSettings()]);
      await Promise.all([pullAnnotations(ids), pullSettings(ids)]);
      live.current.onAfterInitialPull?.();
      if (cancelled) return;
      // Einstellungen aus dem (jetzt gespiegelten) localStorage neu übernehmen.
      reloadSettings();
      bumpSync();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig]);

  // ── Laufende Takte + Rückkehr zur App ──
  useEffect(() => {
    /** Anmerkungen des eigenen Kontos nachladen – pausiert im Zeichenmodus und im Hintergrund. */
    async function refreshAnno() {
      if (document.hidden || live.current.drawMode) return;
      await pullAnnotations(live.current.songs.map((s) => s.id));
      bumpSync();
    }
    /** Rückkehr zur App: Anmerkungen, Einstellungen UND den Ablauf auffrischen. */
    async function onReturn() {
      if (document.hidden) return;
      const now = Date.now();
      if (now - live.current.lastReturn < RETURN_DEBOUNCE_MS) return;
      live.current.lastReturn = now;
      const list = live.current.songs;
      if (!live.current.drawMode) {
        await Promise.all([
          pullAnnotations(list.map((s) => s.id)),
          pullSettings(list.map((s) => s.id)),
        ]);
        reloadSettings();
        bumpSync();
      }
      // Der Ablauf wird auch im Zeichenmodus nachgeladen: Er baut die Seiten nur dann neu, wenn
      // sich wirklich etwas geändert hat, und ohne ihn stünde ein gestrichenes Lied ewig da.
      live.current.onReload?.();
    }
    /** Ablauf/Liedtexte still nachladen – neu gezeichnet wird nur bei echten Änderungen. */
    function refreshContent() {
      if (document.hidden || live.current.drawMode) return;
      live.current.onReload?.();
    }

    const idAnno = setInterval(() => void refreshAnno(), ANNO_REFRESH_MS);
    const idContent = setInterval(() => void refreshContent(), CONTENT_REFRESH_MS);
    // `onReturn` ist async → in einen void-Wrapper, damit kein unbehandeltes Promise entsteht (#279).
    const onReturnSync = (): void => void onReturn();
    window.addEventListener('focus', onReturnSync);
    document.addEventListener('visibilitychange', onReturnSync);
    return () => {
      clearInterval(idAnno);
      clearInterval(idContent);
      window.removeEventListener('focus', onReturnSync);
      document.removeEventListener('visibilitychange', onReturnSync);
    };
    // `reloadSettings` hat eine stabile Identität (useCallback über eine Ref) – die Intervalle und
    // Listener werden dadurch NICHT erneut angemeldet.
  }, [reloadSettings, bumpSync]);

  return { syncTick, setSyncTick, bumpSync };
}

/**
 * Beim SCHLIESSEN des Editors die Chart-Ansicht neu ausrichten.
 *
 * Der Editor liegt als `fixed`-Overlay darüber und verschiebt mit Tastatur/`visualViewport` den
 * Zoom der Seiten dahinter – ohne dieses Signal steht man beim Zurückkommen auf einer „steckenden"
 * Seite. Das Signal stellt den gespeicherten Zoom wieder her bzw. setzt auf Einpassen.
 */
export function useResyncAfterEditor(showEditor: boolean, bumpSync: () => void): void {
  const zuvorOffen = useRef(showEditor);
  useEffect(() => {
    if (zuvorOffen.current && !showEditor) bumpSync();
    zuvorOffen.current = showEditor;
  }, [showEditor, bumpSync]);
}
