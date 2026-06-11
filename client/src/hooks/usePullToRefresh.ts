import { useRef, useState } from 'react';

/** Schwelle (px), ab der das Loslassen ein Neuladen auslöst. */
const THRESHOLD = 70;
/** Maximale sichtbare Zugstrecke. */
const MAX_PULL = 95;

/**
 * „Runterziehen zum Aktualisieren" für einen scrollbaren Container.
 * Nur aktiv, wenn ganz oben gescrollt ist. Gibt Refs/Handler + Zugzustand zurück.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (!refreshing && ref.current && ref.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    } else {
      startY.current = null;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && (ref.current?.scrollTop ?? 0) <= 0) {
      // Widerstand: Zug wird gedämpft dargestellt
      setPull(Math.min(delta * 0.5, MAX_PULL));
    } else {
      setPull(0);
    }
  }

  async function onTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  return {
    ref,
    pull,
    refreshing,
    isTriggered: pull >= THRESHOLD,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
