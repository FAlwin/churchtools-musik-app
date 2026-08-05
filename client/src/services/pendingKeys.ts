/**
 * Merker für Uploads, die noch ausstehen – **in localStorage**, damit sie einen App-Neustart
 * überstehen (#256/#275).
 *
 * Warum es das gibt: Eine Warteschlange nur im Speicher hilft genau dann nicht, wenn man sie am
 * meisten braucht. Ändert jemand ohne Netz etwas und beendet iOS die App im Hintergrund, ist beim
 * nächsten Start unbekannt, dass etwas fehlt – und der erste Abgleich spiegelt den ÄLTEREN
 * Server-Stand über die lokale Änderung. Die Änderung ist dann sichtbar weg.
 *
 * Diese Datei existiert, weil genau dieser Mechanismus zweimal gebraucht wird: für die Anmerkungen
 * (#256) und für die Lied-Einstellungen (#275). Die zweite Fassung von Hand nachzubauen wäre die
 * Fehlerklasse, die dieses Projekt am häufigsten getroffen hat – deshalb liegt er hier EINMAL.
 *
 * Gespeichert werden nur die **Schlüssel**. Was hochzuladen ist, steht ohnehin im localStorage; wie
 * daraus ein Rumpf wird, weiß nur der jeweilige Dienst (bei den Anmerkungen ein Objekt aus mehreren
 * Einträgen, bei den Einstellungen der Wert selbst bzw. `null` fürs Entfernen).
 */
export interface PendingKeys {
  /** Alle Schlüssel, deren Upload noch aussteht. */
  read(): Set<string>;
  /** Schlüssel als ausstehend vermerken (mehrfach aufrufen ist harmlos). */
  mark(key: string): void;
  /** Schlüssel abhaken – Upload ist durch (oder endgültig gescheitert). */
  unmark(key: string): void;
}

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function createPendingKeys(storageKey: string): PendingKeys {
  function read(): Set<string> {
    return new Set(safeParse(localStorage.getItem(storageKey)));
  }

  function write(keys: Set<string>): void {
    try {
      if (keys.size === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify([...keys]));
    } catch {
      // Voller Gerätespeicher: dann bleibt es beim Verhalten von vorher (Merker nur im Speicher).
      // Kein Grund, deshalb den Upload selbst zu verhindern.
    }
  }

  return {
    read,
    mark(key) {
      const keys = read();
      if (keys.has(key)) return;
      keys.add(key);
      write(keys);
    },
    unmark(key) {
      const keys = read();
      if (!keys.delete(key)) return;
      write(keys);
    },
  };
}
