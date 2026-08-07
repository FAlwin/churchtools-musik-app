import { useEffect, useState } from 'react';
import { loadAppLogo } from '../utils/logoAsset';

/**
 * Das App-Logo für die PDF-Kopfzeile, einmalig vorgeladen (#314).
 *
 * Das Laden selbst macht `loadAppLogo` – **nicht** noch einmal hier. Beim Herauslösen aus
 * `ChordChart.tsx` stellte sich heraus, dass es die Funktion längst gab und das Vorladen daneben
 * ZWEIMAL von Hand geschrieben stand (in `ChordChart` und in `dev/DemoPdf`). Nur die Funktion
 * behandelt dabei `onerror`; die Handschriften ließen das Versprechen im Fehlerfall offen. Genau
 * diese Fehlerklasse – dieselbe Regel an mehreren Stellen, die Verbesserung nur an einer – hat
 * dieses Projekt schon mehrfach getroffen.
 *
 * Dieser Hook ist nur die React-Hülle darum: Er hält das Ergebnis im Zustand, damit die PDF neu
 * gebaut wird, sobald das Bild da ist. Zwei Stellen brauchen es – der Seitenstrom und
 * „Als PDF teilen" –, deshalb der eigene Hook statt eines Vorladens im Strom-Hook.
 *
 * Solange das Bild lädt (oder es nicht laden konnte), ist der Wert `null`; die PDF entsteht dann
 * eben ohne Logo. Ein fehlendes Logo darf das Liederheft nicht aufhalten.
 */
export function useAppLogo(): HTMLImageElement | null {
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    void loadAppLogo().then((img) => {
      if (!abgebrochen) setLogo(img);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);
  return logo;
}
