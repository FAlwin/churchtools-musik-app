import { useRef, type MutableRefObject } from 'react';

/**
 * Hält den jeweils AKTUELLEN Wert in einer Ref (#193).
 *
 * Gedacht für Funktionen, die je Render neu entstehen (`restoreVisibleZoom`, `commitInlineText`,
 * die `draws`-Liste …) und aus einem Effekt heraus aufgerufen werden sollen, OHNE dass der Effekt
 * bei jedem Render erneut läuft. Vorher stand an genau diesen Stellen ein `exhaustive-deps`-Disable;
 * mit der Ref darf die Abhängigkeitsliste vollständig sein, denn die Ref-Identität ist stabil.
 *
 * Das Schreiben passiert im Render – bewusst: Wir speichern immer nur den neuesten Wert, und
 * gelesen wird ausschließlich NACH dem Commit (in Effekten und Ereignis-Handlern). Ein verworfener
 * Render kann dadurch keinen veralteten Wert hinterlassen, den jemand noch sehen würde.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
