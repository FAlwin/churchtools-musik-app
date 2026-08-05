import { useCallback, useEffect, useState } from 'react';
import { getSharing as apiGetSharing, setSharing as apiSetSharing } from '../services/teamNotes';

/**
 * Eigenes Teilen der Anmerkungen (Team-Notizen) – Stand laden und umschalten (#276).
 *
 * Eigener Hook, weil hier eine echte kleine Zustandsmaschine steckt, die man prüfen können muss:
 * In `Settings.tsx` stand sie als zwei Einzeiler mit `.catch(() => …)` und war damit ungetestet.
 *
 * **Die Regel dieses Hooks:** Ein vorübergehender Fehler ist NICHT „teilt nicht". Das wäre eine
 * falsche Aussage über die Sichtbarkeit der eigenen Notizen – und beim Abschalten die gefährliche
 * Richtung: Wer „aus" sieht, hält es für erledigt, während der Server weiter „teilt" meldet.
 * Dieselbe Lehre wie #245, #249, #270, #273.
 */
export interface SharingState {
  /** `null` = Stand noch unbekannt (lädt oder nicht ermittelbar). */
  enabled: boolean | null;
  /** Meldung, wenn Laden oder Speichern nicht geklappt hat – sonst `null`. */
  error: string | null;
  /** Umschalten; dreht bei einem Fehler zurück und setzt `error`. */
  toggle: () => void;
}

export function useSharing(active: boolean): SharingState {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let abgebrochen = false;
    void apiGetSharing()
      .then((r) => {
        if (abgebrochen) return;
        setEnabled(r.enabled);
        setError(null);
      })
      .catch(() => {
        if (abgebrochen) return;
        // Bewusst NICHT `setEnabled(false)`: Der Stand ist unbekannt, nicht „aus".
        setError('Der Stand konnte nicht geladen werden. Bitte später erneut öffnen.');
      });
    return () => {
      abgebrochen = true;
    };
  }, [active]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      if (current === null) return current; // Stand unbekannt → nichts umschalten
      const next = !current;
      setError(null);
      void apiSetSharing(next).catch(() => {
        setEnabled(current); // zurückdrehen
        setError(
          next
            ? 'Das Teilen konnte nicht eingeschaltet werden. Bitte erneut versuchen.'
            : 'Das Teilen konnte NICHT abgeschaltet werden – deine Anmerkungen sind weiter sichtbar. Bitte erneut versuchen.',
        );
      });
      return next; // optimistisch
    });
  }, []);

  return { enabled, error, toggle };
}
