import { useEffect, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { pdfOptionsForSong } from '../utils/chartPdfOptions';
import { loadSettings, type SongSettings } from '../utils/chartSettings';
import { generateSetlistPdfWithOwners, type SetlistPageOwner } from '../utils/chordPdf';
import { versionText } from '../utils/songVersions';

/**
 * Baut den durchgehenden Seitenstrom: alle Lieder des Ablaufs zu EINER PDF (#314, Mechanik #197).
 *
 * **Warum das nicht im Render passieren darf:** Bis #197 lief der Aufbau in einem `useMemo`, also
 * mitten im Render. Bei jeder Änderung von Tonart, Spalten oder Schrift stand die Oberfläche, bis
 * das komplette Liederheft neu erzeugt war – auf einem älteren iPad deutlich spürbar: Das Menü blieb
 * offen, nichts reagierte. Jetzt zeichnet der Browser zuerst und baut danach.
 *
 * **Warum Zustand und nicht Memo:** Bis das neue Ergebnis da ist, bleibt das ALTE stehen. Mit einem
 * Memo blitzte zwischendurch eine leere Ansicht auf.
 *
 * Ehrlich: jsPDF bleibt synchron, der Aufbau blockiert also weiterhin kurz den Hauptthread – nur
 * eben NACH dem Zeichnen. Ihn ganz auszulagern bräuchte einen Web Worker (eigenes Thema).
 */

export interface ChartStream {
  data: ArrayBuffer;
  owners: SetlistPageOwner[];
}

interface UseChartStreamArgs {
  songs: SetlistSong[];
  /** Signatur über den INHALT aller Versionen – nur bei echter Änderung wird neu gebaut. */
  songsSig: string;
  /**
   * Die geltenden Einstellungen je Lied. Beim Ansehen fremder Notizen sind das die der anderen
   * Person – nur so passen deren Anmerkungen auf die Seiten.
   */
  settings: Record<number, SongSettings>;
  /**
   * Das vorgeladene App-Logo für die Kopfzeile (aus `useAppLogo`) – `null`, solange es lädt.
   * Bewusst hereingereicht statt hier vorgeladen: „Als PDF teilen" braucht dasselbe Bild.
   */
  logo: HTMLImageElement | null;
}

export function useChartStream({
  songs,
  songsSig,
  settings,
  logo,
}: UseChartStreamArgs): ChartStream | null {
  const [stream, setStream] = useState<ChartStream | null>(null);
  useEffect(() => {
    if (songs.length === 0) {
      setStream(null);
      return;
    }
    let cancelled = false;
    const build = (): void => {
      if (cancelled) return;
      const songsForPdf = songs.map((s) => {
        const st = settings[s.id] ?? loadSettings(s);
        return { ...s, chordpro: versionText(s, st.versionKey), versionKey: st.versionKey };
      });
      const { doc, owners } = generateSetlistPdfWithOwners(songsForPdf, (s) =>
        pdfOptionsForSong(s, settings[s.id] ?? loadSettings(s), logo),
      );
      // Zwischenzeitlich hat sich die Eingabe geändert → dieses Ergebnis ist veraltet, verwerfen.
      if (cancelled) return;
      setStream({ data: doc.output('arraybuffer'), owners });
    };
    // Nach dem Zeichnen bauen; `requestIdleCallback` lässt Eingaben zuerst durch, der Timeout sorgt
    // dafür, dass es auch bei Dauerlast zügig passiert. Ältere Safari-Versionen kennen rIC nicht –
    // dort genügt ein Timeout 0 (auch das läuft erst nach dem Zeichnen).
    let cancelScheduled: () => void;
    if (typeof window.requestIdleCallback === 'function') {
      const h = window.requestIdleCallback(build, { timeout: 300 });
      cancelScheduled = () => window.cancelIdleCallback(h);
    } else {
      const h = window.setTimeout(build, 0);
      cancelScheduled = () => window.clearTimeout(h);
    }
    return () => {
      cancelled = true;
      cancelScheduled();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig, settings, logo]);

  return stream;
}
