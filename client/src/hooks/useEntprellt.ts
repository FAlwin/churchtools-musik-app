import { useEffect, useState } from 'react';

/**
 * Gibt einen Wert erst weiter, wenn er sich `ms` lang nicht mehr geändert hat (#322).
 *
 * Gebraucht für die CCLI-Suche beim Tippen: **Jeder Aufruf geht über ChurchTools weiter zu CCLI**
 * (~800 ms gemessen). Ohne Entprellung würde „Wo ich auch stehe" fünfzehn Suchen auslösen, von denen
 * vierzehn niemand sehen will – und die alle die Gegenstelle belasten (#300).
 *
 * Bewusst allgemein gehalten und ohne Bezug zur Suche: Der Hook weiß nur, dass er wartet. Wann
 * überhaupt gesucht werden darf, entscheidet `automatischSuchen` – das ist eine fachliche Regel und
 * gehört zu den anderen.
 */
export function useEntprellt<T>(wert: T, ms: number): T {
  const [spaeter, setSpaeter] = useState(wert);

  useEffect(() => {
    const timer = setTimeout(() => setSpaeter(wert), ms);
    // Aufräumen ist hier die eigentliche Mechanik: Jeder neue Tastendruck verwirft den vorherigen
    // Timer, deshalb feuert am Ende nur einer.
    return () => clearTimeout(timer);
  }, [wert, ms]);

  return spaeter;
}
