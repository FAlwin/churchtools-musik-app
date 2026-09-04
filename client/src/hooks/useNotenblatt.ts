/**
 * **Das Original-Notenblatt eines Liedes im Editor schreiben oder bearbeiten** – nach dem Anlegen
 * (`NewSongSheet`) und im Stammdaten-Blatt (`EditSongSheet`), Wunsch Alwin 04.09.2026.
 *
 * Herausgezogen aus `useNeuesLied`, als der zweite Aufrufer kam: Zwei Fassungen von „Starttext holen,
 * speichern, Cache verwerfen" wären die nächste Stelle, an der eine Korrektur nur die Hälfte trifft.
 * Die ChurchTools-Aufrufe liegen hier und nicht in den Komponenten – die zeigen nur an.
 *
 * Gespeichert wird als **Original** (`<Titel>.chordpro`), nicht als eigene Fassung: dieselbe
 * Server-Stelle wie der SongSelect-Import (`originalNotenblattSchreiben`), ein Original pro Arrangement.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSongChart, speichereNotenblatt } from '../services/churchtoolsApi';
import { chordproVorlage } from '../utils/activeSongView';

export interface NotenblattZiel {
  songId: number;
  arrangementId: number;
}

/** Was ins Gerüst kommt, wenn es noch kein Blatt gibt. */
export interface NotenblattVorlage {
  title: string;
  key?: string | null;
  ccli?: string | null;
}

export function useNotenblatt(ziel: NotenblattZiel | null) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /**
   * Der Text, mit dem der Editor startet: das vorhandene Blatt oder das Gerüst aus der Vorlage.
   *
   * `hatBlatt: false` spart die Abfrage – nach dem Anlegen eines eigenen Liedes weiß der Aufrufer, dass
   * noch nichts da ist. `null` heißt „nicht bekannt": dann wird nachgesehen (Stammdaten-Blatt).
   */
  const text = async (vorlage: NotenblattVorlage, hatBlatt: boolean | null): Promise<string> => {
    if (!ziel) return '';
    if (hatBlatt !== false) {
      const chart = await getSongChart(ziel.songId, ziel.arrangementId);
      if (chart.chordpro) return chart.chordpro;
    }
    return chordproVorlage(vorlage);
  };

  /** Speichert den Text als Original-Notenblatt. `true` = geklappt (der Editor darf zu). */
  const speichern = async (inhalt: string): Promise<boolean> => {
    if (!ziel || laeuft) return false;
    setLaeuft(true);
    setFehler(null);
    try {
      await speichereNotenblatt(ziel.songId, ziel.arrangementId, inhalt);
      // Das Blatt hat sich geändert – wer das Lied gleich öffnet, soll es sehen, nicht den Cache.
      void queryClient.invalidateQueries({ queryKey: ['song-chart', ziel.songId] });
      return true;
    } catch (e) {
      // Der Grund kommt vom Server (Rechte, Netz) – damit klar ist, ob ein zweiter Versuch Sinn hat.
      setFehler(e instanceof Error ? e.message : 'Das Notenblatt konnte nicht gespeichert werden.');
      return false;
    } finally {
      setLaeuft(false);
    }
  };

  return { text, speichern, laeuft, fehler, zuruecksetzen: () => setFehler(null) };
}
