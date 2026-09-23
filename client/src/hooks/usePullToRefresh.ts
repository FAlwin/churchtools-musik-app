import { useRef, useState } from 'react';

/** Schwelle (px), ab der das Loslassen ein Neuladen auslöst. */
const THRESHOLD = 70;
/** Maximale sichtbare Zugstrecke. */
const MAX_PULL = 95;
/**
 * So lange bleibt die Ladeanzeige mindestens stehen (22.09.2026).
 *
 * Alwin: „bei Abwesenheit und Termine ist das Neuladen nicht richtig. Bei Lied stimmt es." Kommt
 * die Antwort aus einem warmen Cache, ist sie nach wenigen Millisekunden da – der Kreisel blitzt
 * dann nur auf und man hält es für einen Fehlgriff. Die Liedersammlung ist groß und braucht ohnehin
 * länger, deshalb fiel es dort nicht auf. Die Untergrenze macht das Neuladen **sichtbar**, ohne es
 * zu verzögern: Dauert der Abruf länger, wartet hier niemand.
 */
const MIN_ANZEIGE_MS = 450;

/**
 * „Runterziehen zum Aktualisieren" für einen scrollbaren Container.
 * Nur aktiv, wenn ganz oben gescrollt ist. Gibt Refs/Handler + Zugzustand zurück.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
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
      const start = Date.now();
      try {
        await onRefresh();
      } finally {
        const rest = MIN_ANZEIGE_MS - (Date.now() - start);
        if (rest > 0) await new Promise((fertig) => setTimeout(fertig, rest));
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
