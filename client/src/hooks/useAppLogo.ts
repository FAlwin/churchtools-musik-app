import { useEffect, useState } from 'react';
import { logoTightUrl } from '../utils/logoAsset';

/**
 * Das App-Logo für die PDF-Kopfzeile, einmalig vorgeladen (#314).
 *
 * Quelle ist die eingebettete Data-URI aus `logoAsset` – dadurch ist es auch offline sofort da; ein
 * loser Pfad unter `public/` wurde offline nicht zwischengespeichert.
 *
 * Eigener Hook, weil **zwei** Stellen dasselbe Bild brauchen: der durchgehende Seitenstrom und
 * „Als PDF teilen". Zweimal vorladen hieße zweimal dieselbe Regel – und beim nächsten Wechsel der
 * Bildquelle wäre garantiert eine der beiden vergessen worden.
 *
 * Solange das Bild noch lädt, ist der Wert `null`; die PDF entsteht dann eben ohne Logo und wird
 * neu gebaut, sobald es da ist. Ein fehlendes Logo darf das Liederheft nicht aufhalten.
 */
export function useAppLogo(): HTMLImageElement | null {
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = logoTightUrl;
  }, []);
  return logo;
}
