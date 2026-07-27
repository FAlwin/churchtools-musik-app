import { useMemo, useRef, type MutableRefObject } from 'react';

/**
 * Zwei Refs mit **stabiler Array-Identität** – für die beiden sichtbaren Seiten der 2-Seiten-Engine
 * (#193).
 *
 * Vorher stand in `PageDeck` schlicht `const annoRefs = [useRef(), useRef()]`. Die Refs darin sind
 * zwar stabil, das **Array** entstand aber bei jedem Render neu – als Abhängigkeit hätte es jeden
 * Effekt bei jedem Render neu laufen lassen. Genau deshalb waren dort Hook-Prüfungen abgeschaltet.
 * Mit `useMemo` darf das Array in Abhängigkeitslisten stehen.
 */
export function useRefPair<T>(): MutableRefObject<T | null>[] {
  const a = useRef<T | null>(null);
  const b = useRef<T | null>(null);
  return useMemo(() => [a, b], [a, b]);
}
